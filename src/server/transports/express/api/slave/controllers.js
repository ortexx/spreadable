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