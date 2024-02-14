import { assert } from "chai";
import behaviorFail from "../../src/behavior/transports/fail/index.js";

const BehaviorFail = behaviorFail();

export default function () {
  describe('Behavior', () => {
    let behavior;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => behavior = new BehaviorFail());
        behavior.node = this.node;
      });

      it('should create the default properties', function () {
        assert.containsAllKeys(behavior, ['ban', 'banLifetime', 'failSuspicionLevel']);
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await behavior.init();
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await behavior.deinit();
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        await behavior.init();
      });
    });
    
    describe('.destroy()', function () {
      it('should not throw an exception', async function () {
        await behavior.destroy();
      });
    });
  });
}