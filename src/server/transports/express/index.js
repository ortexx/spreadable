const express = require('express');
const Server = require('../server')();
const routes = require('./routes');
const routesClient = require('./client/routes');
const routesApi = require('./api/routes');
const routesApiMaster = require('./api/master/routes');
const routesApiSlave = require('./api/slave/routes');
const routesApiNode = require('./api/node/routes');

module.exports = (Parent) => {
  return class ServerExpress extends (Parent || Server) {
    /**
     * @see Server.prototype.init
     */
    async init() {
      this.app = express();
      this.app.use(this.createRouter(this.getMainRoutes()));
      await super.init.apply(this, arguments);
    }

    getServerHandler() {
      return this.app;
    }
  
    /**
     * Get the main routes
     * 
     * @returns {array}
     */
    getMainRoutes() {
      return [...routes];
    }
  
    /**
     * Get the client routes
     * 
     * @returns {array}
     */
    getClientRoutes() {
      return [...routesClient];
    }
  
    /**
     * Get the api routes
     * 
     * @returns {array}
     */
    getApiRoutes() {
      return [...routesApi];
    }
  
    /**
     * Get the api master routes
     * 
     * @returns {array}
     */
    getApiMasterRoutes() {
      return [...routesApiMaster];
    }
  
    /**
     * Get the api slave routes
     * 
     * @returns {array}
     */
    getApiSlaveRoutes() {
      return [...routesApiSlave];
    }

    /**
     * Get the api node routes
     * 
     * @returns {array}
     */
    getApiNodeRoutes() {
      return [...routesApiNode];
    }
  
    /**
     * Create a router
     * 
     * @param {fn[]} routes 
     * @returns {express.Router}
     */
    createRouter(routes) {
      const router = express.Router();
  
      routes.forEach(route => {
        const fn = Array.isArray(route.fn)? route.fn.map(fn => fn(this.node)): route.fn(this.node);
        router[route.method || 'use'](route.url || '*', fn);
      });
  
      return router;
    }
  }
};