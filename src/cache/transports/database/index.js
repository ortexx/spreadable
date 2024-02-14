import cache from "../cache/index.js";
const Cache = cache();

export default (Parent) => {
  /**
   * Database cache transport
   */
  return class CacheDatabase extends (Parent || Cache) {
    /**
     * @see Cache.prototype.get
     */
    async get(key) {
      const cache = await this.node.db.getCache(this.name, key);
      return cache ? { key: cache.key, value: cache.value } : null;
    }

    /**
     * @see Cache.prototype.set
     */
    async set(key, value) {
      return await this.node.db.setCache(this.name, key, value, this.options);
    }

    /**
     * @see Cache.prototype.remove
     */
    async remove(key) {
      return await this.node.db.removeCache(this.name, key);
    }

    /**
     * @see Cache.prototype.normalize
     */
    async normalize() {
      return await this.node.db.normalizeCache(this.name, this.options);
    }

    /**
     * @see Cache.prototype.flush
     */
    async flush() {
      return await this.node.db.flushCache(this.name);
    }
  };
};
