/**
 * Test the master
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