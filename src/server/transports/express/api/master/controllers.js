/**
 * Get an available node from the network
 */
module.exports.getAvailableNode = node => {
  return async (req, res, next) => {
    try {
      const results = await node.requestSlaves('get-availability-info', node.createRequestSlavesOptions(req.body, {
        responseSchema: node.server.getAvailabilitySlaveResponseSchema()
      }));
      const candidates = await node.filterCandidates(results, await node.getAvailabilityCandidateFilterOptions());    
      res.send({ candidates });
    }
    catch(err) {
      next(err);
    }    
  };
}

/**
 * Test master
 */
module.exports.walk = () => {
  return async (req, res, next) => {
    try {
      res.send({ success: true });
    }
    catch(err) {
      next(err);
    }    
  };
}