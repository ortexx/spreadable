const controllers = require('./controllers');
const midds = require('../midds');

module.exports = [
  { name: 'networkAccess', fn: node => midds.networkAccess(node, { version: true }) },

  /**
   * Get the available node from the network
   * 
   * @api {post} /client/get-available-node
   * @apiSuccess {object} { address }
   */
  {
    name: 'getAvailableNode',
    method: 'post',
    url: '/get-available-node',
    fn: [
      midds.requestQueueClient,
      controllers.getAvailableNode
    ]
  },

  /**
   * Request the approval key
   * 
   * @api {post} /client/request-approval-key
   * @apiParam {string} action
   * @apiSuccess {object} { key, startedAt, approvers, clientIp }
   */
  {
    name: 'requestApprovalKey',
    method: 'post',
    url: '/request-approval-key',
    fn: [
      midds.requestQueueClient,
      controllers.requestApprovalKey
    ]
  },

  /**
   * Request the approval question
   * 
   * @api {post} /client/request-approval-question
   * @apiParam {string} action
   * @apiParam {string} key
   * @apiParam {string[]} confirmedAddresses
   * @apiSuccess {object} { question }
   */
  {
    name: 'requestApprovalQuestion',
    method: 'post',
    url: '/request-approval-question',
    fn: [
      midds.requestQueueClient,
      controllers.requestApprovalQuestion
    ]
  },

  /**
   * Add the approval info
   * 
   * @api {post} /client/add-approval-info
   * @apiParam {string} action
   * @apiParam {string} key
   * @apiParam {object} info
   * @apiParam {number} startedAt
   * @apiSuccess {object} - { info }
   */
  { 
    name: 'addApprovalInfo', 
    method: 'post', 
    url: '/add-approval-info', 
    fn: controllers.addApprovalInfo
  },
];