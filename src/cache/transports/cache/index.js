const _ = require('lodash');
const Service = require('../../../service')();

module.exports = (Parent) => {
  /**
   * Cache transport
   */
  return class Cache extends (Parent || Service) {
    /**
     * @param {Node} node 
     * @param {string} type 
     * @param {object} options
     */
    constructor(node, type, options = {}) {
      super(...arguments);
      this.node = node;
      this.type = type;

      if(!this.type) {
        throw new Error('You must pass the necessary cache type');
      }

      this.options = _.merge({
        limit: 50000
      }, options);
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
  }
};