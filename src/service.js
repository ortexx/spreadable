module.exports = () => {
  /**
   * The service class
   */
  return class Service {
    /**
     * Initialize the service
     * 
     * @async
     */
    async init() {
      this.__initialized = Date.now();
    }

    /**
     * Deinitialize the service
     * 
     * @async
     */
    async deinit() {
      this.__initialized = false;
    }

    /**
     * Destroy the service
     * 
     * @async
     */
    async destroy() {
      this.__destroying = true;
      await this.deinit();
      this.__destroying = false;
    }

    /**
     * Check the service is initialized
     * 
     * @returns {boolean}
     */
    isInitialized() {
      return !!this.__initialized;
    }

    /**
     * Check the service is destroying
     * 
     * @returns {boolean}
     */
    isDestroying() {
      return !!this.__destroying;
    }
  }
};