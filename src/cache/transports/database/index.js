const Cache = require('../cache');

/**
 * The main tasks transport
 */
class CacheDatabase extends Cache {
  /**
   * @see Task.prototype.init
   */
  async init() {
    await super.init();    
  }  

  /**
   * @see Task.prototype.get
   */
  async get(key) {
   return await this.node.db.getCache(key);
  }

  /**
   * @see Task.prototype.set
   * @param {string} value.link
   */
  async set(key, value) {
    return await this.node.db.setCache(key, value.link);
  }

  /**
   * @see Task.prototype.remove
   */
  async remove(key) {
    return await this.node.db.removeCache(key);
   }
}

module.exports = CacheDatabase;