const bodyParser = require('body-parser');
const errors = require('../../../errors');
const utils = require('../../../utils');

/**
 * Set http request client info
 */
module.exports.clientInfo = () => {
  return (req, res, next) => {
    req.clientIp = utils.getRemoteIp(req);
    req.clientAddress = req.headers['original-address'] || `${req.clientIp}:0`;
    next();
  };
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
  return (req, res) => res.send({ success: true, address: node.address });
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
 * Get the network members
 */
module.exports.members = node => {
  return async (req, res, next) => {
    try {
      res.send(await node.db.getData('members'));
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