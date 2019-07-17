const assert = require('chai').assert;
const CacheDatabase = require('../../src/cache/transports/database')();

describe('CacheDatabase', () => {
  let cache;
  let type;

  before(function () {
    type = 'test';
  });
  
  describe('instance creation', function () {
    it('should not create an instance', function () { 
      assert.throws(() => cache = new CacheDatabase(this.node));    
    });

    it('should create an instance', function () { 
      assert.doesNotThrow(() => cache = new CacheDatabase(this.node, type));    
    });    
  });

  describe('.init()', function () { 
    it('should not throw an exception', async function () {
      await cache.init();
    });  
  });

  describe('.set()', function () {
    it('should add the cache', async function () { 
      const key = 'key1'; 
      const value = 1;
      await cache.set(key, value);
      const res = await this.node.db.getCache(type, key);
      assert.equal(res.value, value);
    });
  });

  describe('.get()', function () {
    it('should get the cache', async function () {
      const res = await cache.get('key1');
      assert.equal(res.value, 1);
    });
  });

  describe('.remove()', function () {
    it('should remove the cache', async function () {
      await cache.remove('key1');
      assert.isNull(await cache.get('key1'));
    });
  });

  describe('.deinit()', function () { 
    it('should not throw an exception', async function () {
      await cache.deinit();
    });
  }); 

  describe('reinitialization', () => {
    it('should not throw an exception', async function () {
      await cache.init();
    });
  });
  
  describe('.destroy()', function () { 
    it('should not throw an exception', async function () {
      await cache.destroy();
    });
  });
});