const errors = require('../../../errors');
const utils = require('../../../utils');
const _ = require('lodash');
const crypto = require('crypto');

/**
 * Accept the node is master
 */
module.exports.checkMasterAcception = node => {
  return async (req, res, next) => {
    try {
      if(!(await node.isMaster()) && !req.body.ignoreAcception) {
        throw new errors.WorkError('Master is not accepted', 'ERR_SPREADABLE_MASTER_NOT_ACCEPTED');
      }
    
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
module.exports.updateClientInfo = node => {
  return async (req, res, next) => {
    try {
      const source = req.body.source; 
      const sourceIp = await utils.getHostIp(utils.splitAddress(source)[0]);

      if(!source || !utils.isIpEqual(sourceIp, req.clientIp) || !utils.isValidAddress(source)) {
        return next();
      }

      await node.db.successServerAddress(source);
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
module.exports.networkAccess = (node, checks = {}) => {
  return async (req, res, next) => {    
    try {
      checks = _.merge({ secretKey: true, hostname: false, version: false }, checks);

      if(checks.hostname) {
        const hostname = req.headers['original-hostname'];
      
        if(!hostname || (!utils.isIpEqual(await utils.getHostIp(hostname), req.clientIp))) {
          throw new errors.AccessError('Wrong hostname');
        }

        await node.hostnameFilter(hostname);
      } 

      if(checks.secretKey) {
        if((req.headers['network-secret-key'] || '') != node.options.network.secretKey) {
          throw new errors.AccessError('Wrong network secret key');
        }
      }  
      
      if(checks.version) {
        const version = node.getVersion();

        if(req.headers['node-version'] != version) {
          throw new errors.AccessError(`Client version is different: "${req.headers['node-version']}" and "${version}"`);
        }
      }

      await node.networkAccess(req);
      next();
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Control request's limit for a client by endpoint
 */
module.exports.requestQueueClientByEndpoint = (node) => {
  return (req, res, next) => {
    return this.requestQueue(node, req => `clientByEndpoint=${req.clientIp}=${req.path.split('?')[0]}`, { 
      limit: node.options.request.clientByEndpointConcurrency,
      fnCheck: () => !node.__isFsBlocked
    })(req, res, next);
  }
};

/**
 * Control file request's queue
 */
module.exports.requestQueue = (node, key, options) => {  
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
      
      options = _.merge({
        limit: 1,
        active: true,
        fnCheck: () => true
      }, options);
      
      let interval;
      const check = () => arr.indexOf(req) < options.limit && options.fnCheck(arr);
      arr.push(req);

      res.on('finish', function () {
        interval && clearInterval(interval);
        const index = arr.indexOf(req);
        index != -1 && arr.splice(index, 1);
        !arr.length && delete obj[hash];
      });

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