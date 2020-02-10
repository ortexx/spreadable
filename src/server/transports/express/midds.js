const errors = require('../../../errors');
const utils = require('../../../utils');
const _ = require('lodash');
const crypto = require('crypto');
const Cookies = require('cookies');
const basicAuth = require('basic-auth');
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
 * Update the client info
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
 * Control the current request client access
 */
midds.networkAccess = (node, checks = {}) => {
  checks = _.merge({ 
    auth: true, 
    address: false, 
    version: false, 
  }, checks);

  return async (req, res, next) => {    
    try {
      await node.addressFilter(req.clientAddress);
      await node.networkAccess(req);

      if(
        checks.address && 
        (
          !utils.isValidAddress(req.clientAddress) ||
          !utils.isIpEqual(await utils.getAddressIp(req.clientAddress), req.clientIp)
        )
      ) {      
        throw new errors.AccessError(`Wrong address "${ req.clientAddress }"`);
      }

      if(checks.auth && node.options.network.auth) {
        const auth = node.options.network.auth;
        const cookies = new Cookies(req, res);
        const cookieKey = `spreadableNetworkAuth[${ node.address }]`;
        const cookieKeyValue = cookies.get(cookieKey);
        const info = basicAuth(req);
        const cookieInfo = cookieKeyValue? JSON.parse(Buffer.from(cookieKeyValue, 'base64')): null;
        
        if(
          (!cookieInfo || cookieInfo.username != auth.username || cookieInfo.password != auth.password) && 
          (!info || info.name != auth.username || info.pass != auth.password)
        ) {
          res.setHeader('WWW-Authenticate', `Basic realm="${ node.address }"`);
          await node.db.addBehaviorFail('authentication', req.clientAddress);
          throw new errors.AuthError('Authentication is required');
        }

        await node.db.cleanBehaviorFail('authentication', req.clientAddress);

        if(!cookieKeyValue) {
          cookies.set(cookieKey, Buffer.from(JSON.stringify(auth)).toString('base64'), { 
            maxAge: node.options.network.authCookieMaxAge, 
            httpOnly: false 
          });
        }
      }

      if(checks.version) {
        const version = node.getVersion();

        if(req.headers['node-version'] != version) {
          throw new errors.AccessError(`Node version is different: "${ req.headers['node-version'] }" instead of "${ version }"`);
        }
      }
      
      next();
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Control client requests queue
 */
midds.requestQueueClient = (node, options = {}) => {
  options = _.merge({
    limit: node.options.request.clientConcurrency
  }, options);

  return (req, res, next) => {
    const key = options.key || (req.method + req.originalUrl.split('?')[0]);
    delete options.key;
    return midds.requestQueue(node, key, options)(req, res, next);
  }
};

/**
 * Control parallel requests queue
 */
midds.requestQueue = (node, keys, options) => { 
  options = _.merge({ limit: 1 }, options);  

  return async (req, res, next) => {
    const createPromise = key => {
      return new Promise((resolve, reject) => {
        key = typeof key == 'function'? key(req): key;
        const hash = crypto.createHash('md5').update(key).digest("hex"); 
        const obj = node.__requestQueue;

        if(!hash) {
          throw new errors.WorkError('"hash" is invalid', 'ERR_STORACLE_INVALID_REQUEST_QUEUE_HASH');
        }      
    
        (!obj[hash] || !obj[hash].length) && (obj[hash] = []);
        const arr = obj[hash];
        let finished = false;        
        const finishFn = () => {
          try {
            if(finished) {
              return;
            }

            finished = true;
            req.removeListener('close', finishFn);
            res.removeListener('finish', finishFn);
            const index = arr.findIndex(it => it.req == req);
 
            if(index >= 0) {
              arr.splice(index, 1);
              arr[options.limit - 1] && arr[options.limit - 1].startFn();
            }
            
            !arr.length && delete obj[hash];     
          }
          catch(err) {
            reject(err);
          }
        };
        const startFn = resolve;
        req.on('close', finishFn);  
        res.on('finish', finishFn);
        arr.push({ req, startFn });
        arr.length <= options.limit && startFn();
      });
    }
    
    try {
      !Array.isArray(keys) && (keys = [keys]);
      keys = [...new Set(keys)].filter(it => it);
      const promise = [];

      for(let i = 0; i < keys.length; i++) {
        promise.push(createPromise(keys[i]));
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