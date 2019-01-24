const controllers = require('./controllers');
const midds = require('./midds');

module.exports = [
 { name: 'clientIp', fn: controllers.clientIp }, 
 { name: 'timeout', fn: controllers.timeout }, 
 { name: 'bodyParser', fn: controllers.bodyParser },
 { name: 'api', url: '/api', fn: node => node.server.getApiRouter() },
 { name: 'client', url: '/client', fn: node => node.server.getClientRouter() },
 { name: 'ping', mehtod: 'get', url: '/ping', fn: controllers.ping },
 { name: 'status', mehtod: 'get', url: '/status', fn: [midds.networkAccess, controllers.status] },
 { name: 'indexPage', mehtod: 'get', url: '*', fn: controllers.indexPage },
 { name: 'notFound', fn: controllers.notFound },
 { name: 'handleErrors', fn: controllers.handleErrors }
];