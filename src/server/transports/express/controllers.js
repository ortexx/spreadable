const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const compression = require('compression')
const cors = require('cors');
const errors = require('../../../errors');
const utils = require('../../../utils');

/**
 * Set http request client info
 */
module.exports.clientInfo = (node) => {
  return (req, res, next) => {
    const trusted = [...new Set(['127.0.0.1', node.ip, node.externalIp, node.localIp])];
    req.clientIp = utils.getRemoteIp(req, { trusted });
    req.clientAddress = req.headers['original-address'] || `${req.clientIp}:0`;
    next();
  };
};

/**
 * Response compression
 */
module.exports.compression = (node) => compression({ level: node.options.server.compressionLevel });

/**
 * Cors control
 */
module.exports.cors = () => cors();

/**
 * Provide the request
 */
module.exports.provideRequest = node => {
  return async (req, res, next) => {
    try {
      let headers = Object.assign({}, req.headers);
      const url = req.headers['provider-url'];        
      const timeout = node.createRequestTimeout({ 
        timeout: req.headers['provider-timeout'], 
        timestamp: req.headers['provider-timestamp'] 
      });      

      for(let key in headers) {
        if(key.match(/^provider/i)) {
          delete headers[key];
        }
      }

      try {
        const response = await fetch(url, { body: req, method: req.method, headers, timeout });
        headers = response.headers.raw();
        headers['provider-target'] = 'true';
        res.writeHead(response.status, headers);
        response.body.pipe(res).on('error', next);
      }
      catch(err) {        
        res.setHeader('provider-target', 'true');
        throw err;
      }
    }
    catch(err) {
      //eslint-disable-next-line no-ex-assign
      utils.isRequestTimeoutError(err) && (err = utils.createRequestTimeoutError());
      next(err);
    }
  }
};

/**
 * Set http requests default timeout
 */
module.exports.timeout = () => {
  return (req, res, next) => (req.setTimeout(0), next());
};

/**
 * Set body parser for json handling
 */
module.exports.bodyParser = node => {
  return [ 
    bodyParser.urlencoded({ extended: false, limit: node.options.server.maxBodySize }), 
    bodyParser.json({ limit: node.options.server.maxBodySize }) 
  ];
};

/**
 * Answer to ping requests
 */
module.exports.ping = node => {
  return (req, res) => res.send({
    version: node.getVersion(),
    address: node.address,
    root: node.getRoot()
  });
};

/**
 * Get the node status
 */
module.exports.status = node => {
  return async (req, res, next) => {
    try {
      res.send(await node.getStatusInfo(req.query.pretty !== undefined));
    }
    catch(err) {
      next(err);
    }
  };
};

/**
 * Server index page handler
 */
module.exports.indexPage = () => {
  return (req, res) => res.send({ success: true });
};

/**
 * Handle unknown endpoint requests
 */
module.exports.notFound = () => {
  return (req, res, next) => next(new errors.NotFoundError(`Not found route "${req.originalUrl}"`));
};

/**
 * Handle server errors
 */
module.exports.handleErrors = node => {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if(err instanceof errors.WorkError) {
      res.status(422);  
      return res.send({ message: err.message, code: err.code || 'ERR_SPREADABLE_API' });
    }

    if(err.statusCode) {
      res.status(err.statusCode);  
      return res.send({ message: err.message });
    }
    
    node.logger.error(err.stack);    
    res.status(500);
    res.send({ message: err.message });
  }
};