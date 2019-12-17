const errors = require('../../../errors');
const utils = require('../../../utils');
const _ = require('lodash');
const crypto = require('crypto');
const cors = require('cors');
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
 * Control the parallel requests queue
 */
midds.requestQueue = (node, keys, options) => {  
  options = _.merge({
    limit: 0,
    active: true,
    fnCheck: () => true
  }, options);

  return async (req, res, next) => {    
    !Array.isArray(keys) && (keys = [keys]);
    const promise = [];
    
    try { 
      for(let i = 0; i < keys.length; i++) {        
        let key = keys[i];
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
        const check = () => (!options.limit || arr.indexOf(req) < options.limit) && options.fnCheck(arr);
        arr.push(req);

        if(options.active) {
          if(check()) {
            continue;
          }

          promise.push(new Promise(resolve => {
            interval = setInterval(() => {              
              if(check()) {              
                clearInterval(interval);
                resolve();
              }              
            }, node.__requestQueueInterval);
          }));
        } 
      }

      await Promise.all(promise);
      next();
    }
    catch(err) {
      next(err);
    }
  }
};

module.exports = midds;