const controllers = require('./controllers');

module.exports = [
 { name: 'clientId', fn: controllers.clientId }, 
 { name: 'timeout', fn: controllers.timeout }, 
 { name: 'bodyParser', fn: controllers.bodyParser },
 { name: 'api', url: '/api', fn: node => node.server.getApiRouter() },
 { name: 'client', url: '/client', fn: node => node.server.getClientRouter() },
 { name: 'ping', mehtod: 'get', url: '/ping', fn: controllers.ping },
 { name: 'status', mehtod: 'get', url: '/status', fn: controllers.status },
 { name: 'indexPage', mehtod: 'get', url: '*', fn: controllers.indexPage },
 { name: 'notFound', fn: controllers.notFound },
 { name: 'handleErrors', fn: controllers.handleErrors }
];