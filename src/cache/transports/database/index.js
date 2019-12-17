const Cache = require('../cache')();

module.exports = (Parent) => {
  /**
   * Database cache transport
   */
  return class CacheDatabase extends (Parent || Cache) {
    /**
     * @see Cache.prototype.get
     */
    async get(key) {
      const cache = await this.node.db.getCache(this.type, key);
      return cache? { key: cache.key, value: cache.value }: null;
    }

    /**
     * @see Cache.prototype.set
     */
    async set(key, value) {
      return await this.node.db.setCache(this.type, key, value, this.options);
    }

    /**
     * @see Cache.prototype.remove
     */
    async remove(key) {
      return await this.node.db.removeCache(this.type, key);
    }

    /**
     * @see Cache.prototype.normalize
     */
    async normalize() {
      return await this.node.db.normalizeCache(this.type, this.options);
    }
  }
};