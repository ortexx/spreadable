const express = require('express');
const Server = require('../server')();

module.exports = (Parent) => {
  return class ServerExpress extends (Parent || Server) {
    /**
     * @see Server.prototype.init
     */
    async init() {
      this.app = express();
      this.app.use(this.getMainRouter());
      await super.init.apply(this, arguments);
    }

    getServerHandler() {
      return this.app;
    }
  
    /**
     * Get the main router
     * 
     * @returns {express.Router}
     */
    getMainRouter() {
      return this.createRouter(require('./routes'));
    }
  
    /**
     * Get the client router
     * 
     * @returns {express.Router}
     */
    getClientRouter() {
      return this.createRouter(require('./client/routes'));
    }
  
    /**
     * Get the api router
     * 
     * @returns {express.Router}
     */
    getApiRouter() {
      return this.createRouter(require('./api/routes'));
    }
  
    /**
     * Get the api master router
     * 
     * @returns {express.Router}
     */
    getApiMasterRouter() {
      return this.createRouter(require('./api/master/routes'));
    }
  
    /**
     * Get the api slave router
     * 
     * @returns {express.Router}
     */
    getApiSlaveRouter() {
      return this.createRouter(require('./api/slave/routes'));
    }

    /**
     * Get the api node router
     * 
     * @returns {express.Router}
     */
    getApiNodeRouter() {
      return this.createRouter(require('./api/node/routes'));
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