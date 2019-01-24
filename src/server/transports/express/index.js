const express = require('express');
const Server = require('../server')();
const https = require('https');
const http = require('http');

module.exports = (Parent) => {
  return class ServerExpress extends (Parent || Server) {
    /**
     * @see Server.prototype.init
     */
    async init() {
      this.app = express();
      this.app.use(this.getMainRouter()); 
      await (typeof this.options.https == 'object'? this.runHttpsServer(): this.runHttpServer());
      await super.init();
    }

    /**
     * @see Task.prototype.deinit
     */
    async deinit() {
      this.server && await new Promise((resolve, reject) => this.server.close((err) => err? reject(err): resolve()));
      await super.deinit();
    }
    
    /**
     * @see Task.prototype.runHttpServer
     */
    async runHttpServer() {
      await new Promise((resolve, reject) => this.server = http.createServer(this.app).listen(this.port, err => {
        this.node.logger.info(`Node has been started on http://${this.node.address}`);
        err? reject(err): resolve();
      }));
    }
  
    /**
     * @see Task.prototype.runHttpsServer
     */
    async runHttpsServer() {
      await new Promise((resolve, reject) => this.server = https.createServer(this.options.https, this.app).listen(this.port, err => {
        this.node.logger.info(`Node has been started on https://${this.node.address}`);
        err? reject(err): resolve();
      }));
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
     * Create router
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