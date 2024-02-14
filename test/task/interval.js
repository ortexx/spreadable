import { assert } from "chai";
import interval from "../../src/task/transports/interval/index.js";
import tools from "../tools.js";

const TaskInterval = interval();

export default function () {
  describe('TaskInterval', () => {
    let task;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => task = new TaskInterval());
        task.node = this.node;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await task.init();
      });
    });

    describe('.start()', function () {
      it('should start the task every 100ms', async function () {
        let counter = 0;
        const interval = 100;
        const res = await task.add('test', interval, () => counter++);
        await task.start(res);
        assert.equal(counter, 0, 'check before all');
        await tools.wait(interval / 2);
        assert.equal(counter, 0, 'check after the half iteration');
        await tools.wait(interval / 2);
        assert.equal(counter, 1, 'check after the first iteration');
        await tools.wait(interval);
        assert.equal(counter, 2, 'check after the second iteration');
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
}