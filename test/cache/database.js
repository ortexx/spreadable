import { assert } from "chai";
import database from "../../src/cache/transports/database/index.js";

const CacheDatabase = database();

export default function () {
  describe('CacheDatabase', () => {
    let cache;
    let type;

    before(function () {
      type = 'test';
    });

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => cache = new CacheDatabase());
        cache.node = this.node;
        cache.name = 'test';
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
        assert.equal(res.value, 1, 'check the value');
      });
    });

    describe('.remove()', function () {
      it('should remove the cache', async function () {
        await cache.remove('key1');
        assert.isNull(await cache.get('key1'));
      });
    });

    describe('.flush()', function () {
      it('should remove the cache', async function () {
        const key = 'key';
        await cache.set(key, 1);
        await cache.flush();
        assert.isNull(await cache.get(key));
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
}