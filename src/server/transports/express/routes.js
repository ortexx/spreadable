import * as controllers from "./controllers.js";
import midds from "./midds.js";
export default [
    { name: 'clientInfo', fn: controllers.clientInfo },
    { name: 'timeout', fn: controllers.timeout },
    { name: 'cors', fn: controllers.cors },
    { name: 'compression', fn: controllers.compression },
    { name: 'bodyParser', fn: controllers.bodyParser },
    { name: 'api', url: '/api', fn: node => node.server.createRouter(node.server.getApiRoutes()) },
    { name: 'client', url: '/client', fn: node => node.server.createRouter(node.server.getClientRoutes()) },
    { name: 'ping', method: 'get', url: '/ping', fn: controllers.ping },
    { name: 'status', method: 'get', url: '/status', fn: [midds.networkAccess, controllers.status] },
    { name: 'indexPage', method: 'get', url: '*', fn: [midds.networkAccess, controllers.indexPage] },
    { name: 'notFound', fn: controllers.notFound },
    { name: 'handleErrors', fn: controllers.handleErrors }
];
