

const controllers = require('./controllers');
const midds = require('../../midds');

module.exports = [
  { name: 'checkMasterAcception', fn: midds.checkMasterAcception },

  /**
   * Get a registartion candidade
   * 
   * @api {post} /api/master/register
   * @apiParam {string} target - address as "ip:port"
   * @apiSuccess {object}
   */
  { 
    name: 'register', 
    method: 'post',
    url: '/register',
    fn: controllers.register
  },

  /**
   * Get a random node from the network
   * 
   * @api {post} /api/master/get-available-node
   * @apiSuccess {object} - { candidates: ... }
   */
  { 
    name: 'getAvailableNode', 
    method: 'post', 
    url: '/get-available-node', 
    fn: controllers.getAvailableNode
  }
];
