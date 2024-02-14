import { assert } from "chai";
import cache from "../../src/cache/transports/cache/index.js";

const Cache = cache();

export default function () {
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
}