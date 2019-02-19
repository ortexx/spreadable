
const controllers = require('./controllers');

module.exports = [
  /**
   * Get the node availability info
   * 
   * @api {post} /api/slave/get-availability-info
   * @apiSuccess {object} { availability: ... }
   */
  { 
    name: 'getAvailabilityInfo', 
    method: 'post',
    url: '/get-availability-info', 
    fn: controllers.getAvailabilityInfo
  },
];
