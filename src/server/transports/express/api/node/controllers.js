const errors = require('../../../../../errors');
const utils = require('../../../../../utils');
const schema = require('../../../../../schema');
const _ = require('lodash');

/**
 * Register the node
 */
module.exports.register = node => {
  return async (req, res, next) => {
    try {      
      const target = req.body.target;
      
      if(
        target == node.address ||
        !utils.isValidAddress(target) ||
        !utils.isIpEqual(await utils.getHostIp(utils.splitAddress(target)[0]), req.clientIp)
      ) {
        throw new errors.WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      } 

      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const chain = await node.getBacklinkChain();
      let size = await node.db.getSlavesCount();

      if(await node.db.hasSlave(target)) {
        return res.send({ chain, size });
      }

      let result;

      try {
        result = await node.requestNode(target, 'get-interview-summary', {
          timeout: timer(),
          responseSchema: schema.getInterviewSummaryResponse()
        });
      }
      catch(err) {
        node.logger.warn(err.stack);
        throw new errors.WorkError('Interviewee unavailable', 'ERR_SPREADABLE_INTERVIEW_INTERVIEWEE_NOT_AVAILABLE');
      }

      if(!result.summary || typeof result.summary != 'object') {
        throw new errors.WorkError('Interviewee sent invalid summary', 'ERR_SPREADABLE_INTERVIEW_INVALID_SUMMARY');
      }
      
      await node.interview(result.summary);
      await node.db.addSlave(target);
      size++;      
      res.send({ size, chain });
    }
    catch(err) {
      next(err);
    }    
  }
};

/**
 * Get the node structure
 */
module.exports.structure = node => {
  return async (req, res, next) => {
    try { 
      let backlink = await node.db.getBacklink();
      backlink && backlink.fails && (backlink = null);
      backlink && (backlink = _.pick(backlink, ['address', 'chain']));
      const masters = (await node.db.getMasters()).filter(s => !s.fails).map(m => _.pick(m, ['address', 'size']));      
      const slaves = (await node.db.getSlaves()).filter(s => !s.fails).map(s => _.pick(s, ['address', 'availability']));      
      const members = await node.db.getData('members');
      const availability = await node.getAvailability();
      return res.send({ slaves, masters, backlink, members, availability });
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Get an interview summary
 */
module.exports.getInterviewSummary = node => {
  return async (req, res, next) => {
    try {      
      return res.send({ summary: await node.getInterviewSummary() })
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Provide the node structure
 */
module.exports.provideStructure = node => {
  return async (req, res, next) => {
    try {
      const target = req.body.target;

      if(!utils.isValidAddress(target)) {
        throw new errors.WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      }

      const options = { 
        responseSchema: schema.getStructureResponse(),
        timeout: node.createRequestTimeout(req.body)
      };
      const result = await node.requestNode(target, 'structure', options); 
      res.send(result);
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Provide the node structure group
 */
module.exports.provideGroupStructure = node => {
  return async (req, res, next) => {
    try {      
      const targets = req.body.targets || [];  
      
      if(!Array.isArray(targets) || targets.find(t => !utils.isValidAddress(t))) {
        throw new errors.WorkError('"targets" field is invalid', 'ERR_SPREADABLE_INVALID_TARGETS_FIELD');
      }
      
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const options = { 
        responseSchema: schema.getStructureResponse(),
        timeout: timer(),
        includeErrors: true
      };
      let results = await node.requestGroup(targets.map(t => ({ address: t })), 'structure', options);      
      results = results.map(r => {
        if(r instanceof errors.WorkError) {
          return { message: r.message, code: r.code };
        }
        else if(r instanceof Error) {
          return { message: r.message };
        }

        return r;
      });

      res.send({ results });
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Provide the node registration
 */
module.exports.provideRegistration = node => {
  return async (req, res, next) => {
    try {      
      const target = req.body.target;   

      if(!utils.isValidAddress(target)) {
        throw new errors.WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      }
      
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      let masters = await node.db.getMasters();
      !masters.length && (masters = [{ address: node.address }]);      
      let results;

      try {
        results = await node.provideGroupStructure(masters, { timeout: timer() });
      }
      catch(err) {
        node.logger.warn(err.stack);
        throw new errors.WorkError('Provider failed', 'ERR_SPREADABLE_PROVIDER_FAIL');
      }

      for(let i = results.length - 1; i >= 0; i--) {
        const result = results[i];

        if(!result.slaves.length && result.address != node.address) {
          results.splice(i, 1);
          continue;
        }

        let info = {};
        info.address = result.address;
        info.networkSize = await node.getNetworkSize(result.masters);
        info.candidates = result.slaves.length? result.slaves.map(s => _.pick(s, ['address'])): [{ address: node.address }];        
        results[i] = info;
      }
      
      const syncLifetime = await node.getSyncLifetime();
      const networkSize = await node.getNetworkSize();
      res.send({ results, syncLifetime, networkSize });
    }
    catch(err) {
      next(err);
    }
  }
};