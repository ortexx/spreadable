/**
 * The main tasks transport
 */
class Cache {
  /**
   * @param {Node} node 
   * @param {object} options 
   */
  constructor(node, options = {}) {
    this.node = node;
    this.options = options;
  }

  /**
   * Initialize the cache system
   * 
   * @async
   */
  async init() {
    this.node.logger.info(`Cache system has been initialized`);
  }

  /**
   * Destroy the datache systemabase
   * 
   * @async
   */
  async destroy() {
    this.node.logger.info(`Cache system has been destroyed`);
  }

  /**
   * Get cache
   * 
   * @async
   * @param {string} key
   */
  async get() {
    throw new Error('Method "get" is required for cache transport');
  }

  /**
   * Get cache
   * 
   * @async
   * @param {string} key
   * @param {object} value
   */
  async set() {
    throw new Error('Method "set" is required for cache transport');
  }

  /**
   * Remove cache
   * 
   * @async
   * @param {string} key
   */
  async remove() {
    throw new Error('Method "remove" is required for cache transport');
  }
}

module.exports = Cache;