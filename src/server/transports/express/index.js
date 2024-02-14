import express from "express";
import server from "../server/index.js";
import routes from "./routes.js";
import routesClient from "./client/routes.js";
import routesApi from "./api/routes.js";
import routesApiMaster from "./api/master/routes.js";
import routesApiButler from "./api/butler/routes.js";
import routesApiSlave from "./api/slave/routes.js";
import routesApiNode from "./api/node/routes.js";

const Server = server();

export default (Parent) => {
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
     * Get the api butler routes
     *
     * @returns {array}
     */
    getApiButlerRoutes() {
      return [...routesApiButler];
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
        const fn = Array.isArray(route.fn) ? route.fn.map(fn => fn(this.node)) : route.fn(this.node);
        const rfn = router[route.method || 'use'].bind(router);
        route.url ? rfn(route.url, fn) : rfn(fn);
      });
      return router;
    }
  };
};
