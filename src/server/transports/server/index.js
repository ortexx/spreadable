import Service from "../../../service.js";
import utils from "../../../utils.js";
import https from "https";
import http from "http";

export default (Parent) => {
  /**
   * The main server transport
   */
  return class Server extends (Parent || Service) {

    /**
     * @param {object} options
     * @param {object|boolean} [options.https]
     */
    constructor(options = {}) {
      super(...arguments);
      this.options = options;
    }

    /**
     * Initialize the server
     *
     * @async
     */
    async init() {
      this.port = this.node.port;

      if (await utils.isPortUsed(this.port)) {
        throw new Error(`Port ${this.port} is already used`);
      }

      await this.startServer();
      await super.init.apply(this, arguments);
    }

    /**
     * Deinitialize the server
     *
     * @async
     */
    async deinit() {
      await this.stopServer();
      await super.deinit.apply(this, arguments);
    }

    /**
     * Run an http server
     *
     * @async
     */
    async runHttpServer() {
      await new Promise((resolve, reject) => this.server = http.createServer(this.getServerHandler()).listen(this.port, err => {
        this.node.logger.info(`Node has been started on http://${this.node.address}`);
        err ? reject(err) : resolve();
      }));
    }

    /**
     * Run an https server
     *
     * @async
     */
    async runHttpsServer() {
      const options = this.options.https;
      const handler = this.getServerHandler();
      await new Promise((resolve, reject) => this.server = https.createServer(options, handler).listen(this.port, err => {
        this.node.logger.info(`Node has been started on https://${this.node.address}`);
        err ? reject(err) : resolve();
      }));
    }

    /**
     * Start the server
     *
     * @async
     */
    async startServer() {
      await (typeof this.options.https == 'object' ? this.runHttpsServer() : this.runHttpServer());
    }

    /**
     * Stop the server
     *
     * @async
     */
    async stopServer() {
      this.server && await new Promise((resolve, reject) => this.server.close((err) => err ? reject(err) : resolve()));
    }
    
    getServerHandler() {
      return (req, res) => res.end('success');
    }
  };
};
