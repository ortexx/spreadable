
const controllers = require('./controllers');

module.exports = [
  /**
   * Register the address
   * 
   * @api {post} /api/slave/register
   * @apiParam {string} target - address as "ip:port"
   */
  { 
    name: 'register', 
    method: 'post', 
    url: '/register', 
    fn: controllers.register
  },

  /**
   * Get an interview summary
   * 
   * @api {post} /api/slave/get-interview-summary
   * @apiSuccess {object}
   */
  { 
    name: 'getInterviewSummary', 
    method: 'post', 
    url: '/get-interview-summary', 
    fn: controllers.getInterviewSummary
  },

  /**
   * Sync the node to master
   * 
   * @api {post} /api/slave/sync-up
   * @apiParam {string} target - address as "ip:port"
   */
  { 
    name: 'syncUp', 
    method: 'post',
    url: '/sync-up', 
    fn: controllers.syncUp
  },

  /**
   * Sync the node from master
   * 
   * @api {post} /api/slave/sync-up
   * @apiParam {string} target - address as "ip:port"
   */
  { 
    name: 'syncDown', 
    method: 'post',
    url: '/sync-down', 
    fn: controllers.syncDown
  },

  /**
   * Provide the registartion
   * 
   * @api {post} /api/slave/provide-registration
   * @apiParam {string} target - address as "ip:port"
   * @apiSuccess {object} - { results: [...] }
   */
  { 
    name: 'provideRegistration', 
    method: 'post', 
    url: '/provide-registration', 
    fn: controllers.provideRegistration
  },

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
