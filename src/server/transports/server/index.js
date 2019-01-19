module.exports = () => {
  /**
   * The main server transport
   */
  return class Server {
    /**
     * @param {Node} node 
     * @param {object} options 
     * @param {integer} options.port
     */
    constructor(node, options = {}) {
      this.node = node;
      this.port = options.port;
      this.options = options;

      if(!this.port) {
        throw new Error('You must pass the necessary port');
      }
    }

    /**
     * Initialize the server
     * 
     * @async
     */
    async init() {
      this.__initialized = true;
      this.node.logger.info(`Server has been initialized`);
    }

    /** 
     * Denitialize the server
     * 
     * @async
     */
    async deinit() {
      this.__initialized = false;
      this.node.logger.info(`Server has been deinitialized`);
    } 

    /**
     * Destroy the server
     * 
     * @async
     */
    async destroy() {
      await this.deinit();
      this.node.logger.info(`Server has been destroyed`);
    }

    /**
     * Run http server
     * 
     * @async
     */
    async runHttpServer() {
      throw new Error('Method "runHttpServer" is required for server transport');
    }

    /**
     * Run https server
     * 
     * @async
     */
    async runHttpsServer() {
      throw new Error('Method "runHttpsServer" is required for server transport');
    }
  }
};

