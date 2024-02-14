import logger from "../logger/index.js";
import transports from "../../index.js";

const Logger = logger();

export default (Parent) => {
  /**
   * Console logger transport
   */
  return class LoggerAdapter extends (Parent || Logger) {
    static transports = transports;

    constructor() {
      super(...arguments);
      this.transports = [];
    }

    /**
     * @see Logger.prototype.init
     */
    async init() {
      const arr = this.options.transports || [];

      for(let i = 0; i < arr.length; i++) {
        const obj = arr[i];
        const transports = this.constructor.transports[obj.transport];
        const CurrentLogger = typeof obj.transport == 'string'? transports: obj.transport;       
        const logger = new CurrentLogger(obj.options);
        logger.node = this.node;
        await logger.init();
        this.addTransport(logger);
      }

      return await super.init.apply(this, arguments);
    }

    /**
     * @see Logger.prototype.deinit
     */
    async deinit() {
      for (let i = 0; i < this.transports.length; i++) {
        await this.transports[i].deinit();
      }
      
      this.transports = [];
      return await super.deinit.apply(this, arguments);
    }

    /**
     * @see Logger.prototype.destroy
     */
    async destroy() {
      for (let i = 0; i < this.transports.length; i++) {
        await this.transports[i].destroy();
      }

      return await super.destroy.apply(this, arguments);
    }

    /**
     * @see Logger.prototype.log
     */
    async log(level, message) {
      if (!this.isLevelActive(level)) {
        return;
      }

      for (let i = 0; i < this.transports.length; i++) {
        await this.transports[i].log(level, message);
      }
    }

    /**
     * Add a new transport
     *
     * @param {Logger} transport
     */
    addTransport(transport) {
      this.transports.push(transport);
    }

    /**
     * remove the transport
     *
     * @param {Logger} transport
     */
    removeTransport(transport) {
      this.transports.splice(this.transports.indexOf(transport), 1);
    }
  };
};
