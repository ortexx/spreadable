const midds = require('../midds');

module.exports = [ 
  { name: 'networkAccess', fn: node => midds.networkAccess(node, { address: true, version: true }) },  
  { name: 'updateClientInfo', fn: midds.updateClientInfo },
  { name: 'master', url: '/master', fn: node => node.server.getApiMasterRouter() },
  { name: 'slave', url: '/slave', fn: node => node.server.getApiSlaveRouter() },
  { name: 'node', url: '/node', fn: node => node.server.getApiNodeRouter() }
];