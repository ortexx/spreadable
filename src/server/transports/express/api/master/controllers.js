const WorkError = require('../../../../../errors');
const utils = require('../../../../../utils');

/**
 * Register the node
 */
module.exports.register = node => {
  return async (req, res, next) => {
    try {      
      const target = req.body.target;
      
      if(!utils.isValidAddress(target)) {
        throw new WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      }

      const networkSize = await node.getNetworkSize();

      if(!(await node.isMaster())) { 
        if(node.address == target) {
          return res.send({
            networkSize,
            candidate: null,  
            isMaster: false
          });
        }

        return res.send({ 
          networkSize,
          candidate: { address: node.address },
          isMaster: false
        });
      }
      
      const coef = Math.sqrt(networkSize);
      const slaves = await node.db.getSlaves();
      const candidates = slaves.filter(s => s.address != target);
      const candidate = utils.getRandomElement(candidates);
      
      return res.send({ 
        address: node.address,
        candidate: candidate? { address: candidate.address }: null,
        isMaster: true,
        isFree: slaves.length < coef,
        count: slaves.length,
        networkSize
      });
    }
    catch(err) {
      next(err);
    }    
  }
};

/**
 * Get an available node from the network
 */
module.exports.getAvailableNode = node => {
  return async (req, res, next) => {
    try {
      const results = await node.requestSlaves('get-availability-info', node.createRequestSlavesOptions(req.body));      
      const candidates = node.filterCandidates(results, await node.getAvailabilityCandidateFilterOptions()); 
      res.send({ candidates });
    }
    catch(err) {
      next(err);
    }    
  };
}