const Service = require('../../../service')();
const https = require('https');
const http = require('http');

module.exports = (Parent) => {
  /**
   * The main server transport
   */
  return class Server extends (Parent || Service) {
    /**
     * @param {Node} node 
     * @param {object} options
     *  @param {object|boolean} [options.https]
     */
    constructor(node, options = {}) {
      super(...arguments);
      this.node = node;
      this.port = this.node.port;
      this.options = options;
    }

    /**
     * Initialize the server
     * 
     * @async
     */
    async init() {
      await this.startServer();
      await super.init.apply(this, arguments);
    }

    /** 
     * Denitialize the server
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
         err? reject(err): resolve();
       }));
     }
  
    /**
     * Run an https server
     * 
     * @async
     */
    async runHttpsServer() {
      await new Promise((resolve, reject) => this.server = https.createServer(this.options.https, this.getServerHandler()).listen(this.port, err => {
        this.node.logger.info(`Node has been started on https://${this.node.address}`);
        err? reject(err): resolve();
      }));
    }

    /**
     * Start the server
     * 
     * @async
     */
    async startServer() {
      await (typeof this.options.https == 'object'? this.runHttpsServer(): this.runHttpServer());
    }

    /**
     * Stop the server
     * 
     * @async
     */
    async stopServer() {
      this.server && await new Promise((resolve, reject) => this.server.close((err) => err? reject(err): resolve()));
    }

    getServerHandler() {
      return (req, res) => res.end('success');
    }
  }
};

