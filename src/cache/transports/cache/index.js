import merge from "lodash-es/merge.js";
import Service from "../../../service.js";
import utils from "../../../utils.js";

export default (Parent) => {
  /**
   * Cache transport
   */
  return class Cache extends (Parent || Service) {
    /**
     * @param {object} options
     */
    constructor(options = {}) {
      super(...arguments);
      this.options = merge({
        limit: 50000
      }, options);
      
      if (this.options.lifetime !== undefined) {
        this.options.lifetime = utils.getMs(this.options.lifetime);
      }
    }

    /**
     * Get the cache
     *
     * @async
     * @param {string} key
     */
    async get() {
      throw new Error('Method "get" is required for cache transport');
    }

    /**
     * Get the cache
     *
     * @async
     * @param {string} key
     * @param {object} value
     */
    async set() {
      throw new Error('Method "set" is required for cache transport');
    }

    /**
     * Remove the cache
     *
     * @async
     * @param {string} key
     */
    async remove() {
      throw new Error('Method "remove" is required for cache transport');
    }

    /**
     * Normalize the cache
     *
     * @async
     */
    async normalize() {
      throw new Error('Method "normalize" is required for cache transport');
    }

    /**
     * Flush the cache
     *
     * @async
     */
    async flush() {
      throw new Error('Method "flush" is required for cache transport');
    }
  };
};
