const assert = require('chai').assert;
const Behavior = require('../../src/behavior/transports/behavior')();

describe('Behavior', () => {
  let behavior;
  
  describe('instance creation', function () {
    it('should create an instance', function () {
      assert.doesNotThrow(() => behavior = new Behavior());
      behavior.node = this.node;
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