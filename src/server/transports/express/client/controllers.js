/**
 * Get a random node address from the network
 */
module.exports.getAvailableNode = node => {
  return async (req, res, next) => {
    try {      
      const address = await node.getAvailableNode({ timeout: node.createRequestTimeout(req.body) });
      res.send({ address });
    }
    catch(err) {
      next(err);
    }
  }
};