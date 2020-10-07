const assert = require('chai').assert;
const TaskCron = require('../../src/task/transports/cron')();
const tools = require('../tools');

describe('TaskCron', () => {
  let task;
  
  describe('instance creation', function () {
    it('should create an instance', function () {
      assert.doesNotThrow(() => task = new TaskCron());
      task.node = this.node;
    });
  });

  describe('.init()', function () { 
    it('should not throw an exception', async function () {
      await task.init();
    });  
  });

  describe('.start()', function () { 
    it('should start the task every 1s', async function () {
      let counter = 0;
      const interval = 1000;
      const res = await task.add('test', '* * * * * *', () => counter++);      
      await task.start(res);
      assert.equal(counter, 0, 'check before');
      await tools.wait(interval * 2);
      assert.isOk(counter > 0, 'check after');
    });
  });

  describe('.deinit()', function () { 
    it('should not throw an exception', async function () {
      await task.deinit();
    });
  }); 

  describe('reinitialization', () => {
    it('should not throw an exception', async function () {
      await task.init();
    });
  });
  
  describe('.destroy()', function () { 
    it('should not throw an exception', async function () {
      await task.destroy();
    });
  });
});