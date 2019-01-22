const errors = require('../../../../../errors');
const utils = require('../../../../../utils');

/**
 * Register the node
 */
module.exports.register = node => {
  return async (req, res, next) => {
    try {
      const target = req.body.target;
      const targetIp = await utils.getHostIp(utils.splitAddress(target)[0]);    
      
      if(!targetIp || !utils.isIpEqual(targetIp, req.clientIp) || !utils.isValidAddress(target) || target == node.address) {
        throw new errors.WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      }

      const backlinkChain = await node.getBacklinkChain();

      if(await node.db.hasSlave(target)) {
        return res.send({ success: true, backlinkChain });
      }

      let result

      try {
        result = await node.requestSlave(target, 'get-interview-summary');
      }
      catch(err) {
        throw new errors.WorkError('Interviewee unavailable', 'ERR_SPREADABLE_INTERVIEW_INTERVIEWEE_NOT_AVAILABLE');
      }

      if(!result.summary || typeof result.summary != 'object') {
        throw new errors.WorkError('Interviewee sent invalid summary', 'ERR_SPREADABLE_INTERVIEW_INVALID_SUMMARY');
      }
      
      await node.interview(result.summary);

      if(await node.isMaster()) {
        const networkSize = await node.getNetworkSize();
        const coef = Math.sqrt(networkSize);

        if(await node.db.getSlavesCount() >= coef) {
          throw new errors.WorkError('Master is full', 'ERR_SPREADABLE_MASTER_FULL');
        }
      }

      await node.db.addSlave(target);     
      res.send({ success: true, backlinkChain });
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
 * Sync the node to master
 */
module.exports.syncUp = node => {
  return async (req, res, next) => {
    try {
      const target = req.body.target;
      const targetIp = await utils.getHostIp(utils.splitAddress(target)[0]);  
      const masters = req.body.masters || [];         

      if(!targetIp || !utils.isIpEqual(targetIp, req.clientIp) || !utils.isValidAddress(target)) {
        throw new errors.WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      }

      if(!await node.db.hasSlave(target)) {
        return res.send({ hasTargetSlave: false });
      }

      await node.updateMastersInfo(masters);
      res.send({ hasTargetSlave: true });
    }
    catch(err) {
      next(err);
    }    
  }
};

/**
 * Sync the node from master
 */
module.exports.syncDown = node => {
  return async (req, res, next) => {
    try {
      const target = req.body.target;
      const targetIp = await utils.getHostIp(utils.splitAddress(target)[0]); 
      const backlinkChain = req.body.backlinkChain || [];
      const masters = req.body.masters || [];

      if(!targetIp || !utils.isIpEqual(targetIp, req.clientIp) || !utils.isValidAddress(target)) {
        throw new errors.WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      }     
      
      const backlink = await node.db.getBacklink();

      if(!backlink || backlink.address != target) {       
        return res.send({ hasTargetMaster: false });
      }

      await node.db.addBacklink(backlink.address, backlinkChain);
      await node.updateMastersInfo(masters);
      res.send({ hasTargetMaster: true });
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
      
      const results = await node.requestMasters('register', { 
        timeout: node.createRequestTimeout(req.body), 
        body: req.body
      });

      res.send({ results });
    }
    catch(err) {
      next(err);
    }    
  }
};

/**
 * Get the node availability info
 */
module.exports.getAvailabilityInfo = node => {
  return async (req, res, next) => {
    try {
      res.send({ availability: await node.getAvailability()  });
    }
    catch(err) {
      next(err);
    }    
  }
};