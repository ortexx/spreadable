module.exports = () => {
  /**
   * logger transport interface
   */
  return class Logger {
    /**
     * @param {Node} node 
     * @param {object} options 
     */
    constructor(node, options = {}) {
      this.node = node;
      this.options = options;    
      this.levels = ['info', 'warn', 'error'];
    }

    /** 
     * Initialize the logger
     * 
     * @async
     */
    async init() {
      this.setLevel(this.options.level === undefined? 'info': this.options.level);
      this.__initialized = true;
      this.node.logger.info(`Logger has been initialized`);
    }

    /** 
     * Denitialize the logger
     * 
     * @async
     */
    async deinit() {
      this.setLevel(false);
      this.__initialized = false;
      //eslint-disable-next-line no-console  
      console.info(`Logger has been deinitialized`);
    }   

    /**
     * Destroy the logger
     * 
     * @async
     */
    async destroy() {
      await this.deinit();
      //eslint-disable-next-line no-console  
      console.info(`Logger has been destroyed`);
    }
    
    /**
     * Log by levels
     * 
     * @async
     * @param {string} level
     */
    async log() {
      throw new Error('Method "log" is required for logger transport');
    }

    /**
     * Log info
     * 
     * @async
     */
    async info(...args) {
      await this.log('info', ...args);
    }

    /**
     * Log warning
     * 
     * @async
     */
    async warn(...args) {
      await this.log('warn', ...args);
    }

    /**
     * Log error
     * 
     * @async
     */
    async error(...args) {
      await this.log('error', ...args);
    }

    /**
     * Check log level is active
     * 
     * @param {string} level
     */
    isLevelActive(level) { 
      if(!this.level) {
        return false;
      }
      
      return this.levels.indexOf(level) >= this.levels.indexOf(this.level)
    }

    /**
     * Set the active level
     * 
     * @param {string} level
     */
    setLevel(level) {
      if(level === false) {
        return this.level = false;
      }

      if(this.levels.indexOf(level) == -1) {
        throw new Error(`Wrong logger level "${level}"`);
      }    

      this.level = level;
    }
  }
};