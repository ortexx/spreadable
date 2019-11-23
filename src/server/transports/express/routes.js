const controllers = require('./controllers');
const midds = require('./midds');

module.exports = [
 { name: 'clientInfo', fn: controllers.clientInfo }, 
 { name: 'timeout', fn: controllers.timeout }, 
 { name: 'bodyParser', fn: controllers.bodyParser },
 { name: 'cors', fn: midds.cors },
 { name: 'api', url: '/api', fn: node => node.server.createRouter(node.server.getApiRoutes()) },
 { name: 'client', url: '/client', fn: node => node.server.createRouter(node.server.getClientRoutes()) },
 { name: 'ping', mehtod: 'get', url: '/ping', fn: controllers.ping },
 { name: 'status', mehtod: 'get', url: '/status', fn: [midds.networkAccess, controllers.status] },
 { name: 'members', mehtod: 'get', url: '/members', fn: [midds.networkAccess, controllers.members] },
 { name: 'indexPage', mehtod: 'get', url: '*', fn: controllers.indexPage },
 { name: 'notFound', fn: controllers.notFound },
 { name: 'handleErrors', fn: controllers.handleErrors }
];