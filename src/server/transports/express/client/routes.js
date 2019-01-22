

const controllers = require('./controllers');
const midds = require('../midds');

module.exports = [
  { name: 'networkAccess', fn: midds.networkAccess },
  { name: 'clientByEndpointLimit', fn: midds.requestQueueClientByEndpoint },

  /**
   * Get an available node from the network
   * 
   * @api {post} /client/get-available-node
   */
  {
    name: 'getAvailableNode', 
    method: 'post', 
    url: '/get-available-node', 
    fn: controllers.getAvailableNode
  }
];