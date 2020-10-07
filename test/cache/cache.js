const assert = require('chai').assert;
const Cache = require('../../src/cache/transports/cache')();

describe('Cache', () => {
  let cache;

  describe('instance creation', function () {
    it('should create an instance', function () { 
      assert.doesNotThrow(() => cache = new Cache());  
      cache.node = this.node;
      cache.name = 'test';
    });
  });

  describe('.init()', function () { 
    it('should not throw an exception', async function () {
      await cache.init();
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