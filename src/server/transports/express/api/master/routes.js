

const controllers = require('./controllers');
const midds = require('../../midds');

module.exports = [
  { name: 'checkMasterAcception', fn: midds.checkMasterAcception },

  /**
   * Get an available node from the network
   * 
   * @api {post} /api/master/get-available-node
   * @apiSuccess {object} - { candidates: ... }
   */
  { 
    name: 'getAvailableNode', 
    method: 'post', 
    url: '/get-available-node',
    fn: controllers.getAvailableNode
  },

  /**
   * Test master
   * 
   * @api {post} /api/master/walk
   * @apiSuccess {object} - { success: ... }
   */
  { 
    name: 'walk',
    method: 'post',
    url: '/walk',
    fn: controllers.walk
  }
];
