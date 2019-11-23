const midds = require('../midds');

module.exports = [ 
  { name: 'networkAccess', fn: node => midds.networkAccess(node, { address: true, version: true }) },  
  { name: 'updateClientInfo', fn: midds.updateClientInfo },
  { name: 'master', url: '/master', fn: node => node.server.createRouter(node.server.getApiMasterRoutes()) },
  { name: 'slave', url: '/slave', fn: node => node.server.createRouter(node.server.getApiSlaveRoutes()) },
  { name: 'node', url: '/node', fn: node => node.server.createRouter(node.server.getApiNodeRoutes()) }
];