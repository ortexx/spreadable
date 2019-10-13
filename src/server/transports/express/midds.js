const errors = require('../../../errors');
const utils = require('../../../utils');
const _ = require('lodash');
const crypto = require('crypto');
const cors = require('cors');
const url = require('url');
const midds = {};

/**
 * Cors control
 */
midds.cors = () => cors();

/**
 * Accept the node is master
 */
midds.checkMasterAcception = node => {
  return async (req, res, next) => {
    try {
      const size = await node.db.getSlavesCount();
      
      if(!size && !req.body.ignoreAcception) {
        throw new errors.WorkError('Master is not accepted', 'ERR_SPREADABLE_MASTER_NOT_ACCEPTED');
      }

      res.setHeader('spreadable-master-size', size);
      next();
    }
    catch(err) {
      next(err)
    }
  }
};

/**
 * Update client info
 */
midds.updateClientInfo = node => {
  return async (req, res, next) => {
    try {
      await node.db.successServerAddress(req.clientAddress);
      next();
    }
    catch(err) {
      next(err);
    }    
  }
};

/**
 * Control the current request's client access
 */
midds.networkAccess = (node, checks = {}) => {
  checks = _.merge({ secretKey: true, address: false, version: false }, checks);

  return async (req, res, next) => {    
    try {
      if(checks.secretKey) {
        if((req.headers['network-secret-key'] || '') != node.options.network.secretKey) {
          throw new errors.AccessError('Wrong network secret key');
        }
      }

      if(checks.version) {
        const version = node.getVersion();

        if(req.headers['node-version'] != version) {
          throw new errors.AccessError(`Client version is different: "${req.headers['node-version']}" instead of "${version}"`);
        }
      }

      let address = utils.createAddress(req.clientIp, 1);

      if(checks.address) {
        address = req.clientAddress;
      
        if(!utils.isValidAddress(address) || (!utils.isIpEqual(await utils.getAddressIp(address), req.clientIp))) {
          throw new errors.AccessError(`Wrong address "${address}"`);
        }
      }

      await node.addressFilter(address);
      await node.networkAccess(req);
      next();
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Control all parallel requests to the client endpoints
 */
midds.requestQueueClientEndpoint = (node) => {
  return (req, res, next) => {
    return midds.requestQueue(node, url.parse(req.originalUrl).pathname, { 
      limit: node.options.request.clientEndpointConcurrency
    })(req, res, next);
  }
};

/**
 * Control the parallel requests queue
 */
midds.requestQueue = (node, key, options) => {  
  options = _.merge({
    limit: 1,
    active: true,
    fnCheck: () => true
  }, options);

  return async (req, res, next) => { 
    try {   
      key = typeof key == 'function'? key(req): key;
      const hash = crypto.createHash('md5').update(key).digest("hex"); 
      const obj = node.__requestQueue;

      if(!hash) {
        throw new errors.WorkError('"hash" is invalid', 'ERR_STORACLE_INVALID_REQUEST_QUEUE_HASH');
      }      
  
      (!obj[hash] || !obj[hash].length) && (obj[hash] = []);
      const arr = obj[hash];
      
      const finish = () => {        
        interval && clearInterval(interval);
        const index = arr.indexOf(req);
        index != -1 && arr.splice(index, 1);
        !arr.length && delete obj[hash];
        req.removeListener('close', finish);
        res.removeListener('finish', finish);
      };

      req.on('close', finish);  
      res.on('finish', finish);

      let interval;
      const check = () => arr.indexOf(req) < options.limit && options.fnCheck(arr);
      arr.push(req);

      if(options.active) {
        if(check()) {
          return next();
        }

        await new Promise(resolve => {
          interval = setInterval(() => {
            if(check()) {              
              clearInterval(interval);
              resolve();
            }
          }, node.__requestQueueInterval);
        });
      }  

      next();
    }
    catch(err) {
      next(err);
    }
  }
};

module.exports = midds;