const assert = require('chai').assert;
const BehaviorFail = require('../../src/behavior/transports/fail')();

describe('Behavior', () => {
  let behavior;
  
  describe('instance creation', function () {
    it('should create an instance', function () {
      assert.doesNotThrow(() => behavior = new BehaviorFail(this.node));
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