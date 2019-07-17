

const controllers = require('./controllers');
const midds = require('../../midds');

module.exports = [
  { name: 'checkMasterAcception', fn: midds.checkMasterAcception },

  /**
   * Test the master
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
