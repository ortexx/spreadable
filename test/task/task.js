import { assert } from "chai";
import task from "../../src/task/transports/task/index.js";
import tools from "../tools.js";

const Task = task();

export default function () {
  describe('Task', () => {
    let task;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => task = new Task());
        task.node = this.node;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await task.init();
      });
    });

    describe('.add()', function () {
      it('should create the task', async function () {
        const name = 'test';
        const interval = 1;
        const option = 1;
        await task.add(name, interval, () => { }, { test: option });
        const res = task.tasks[name];
        assert.isObject(res, 'chek the object');
        assert.equal(res.name, name, 'check the name');
        assert.equal(res.interval, interval, 'check the interval');
        assert.equal(res.test, option, 'check the option');
      });

      it('should update the task', async function () {
        const name = 'test';
        const interval = 2;
        const option = 2;
        await task.add(name, interval, () => { }, { test: option });
        const res = task.tasks[name];
        assert.isObject(res, 'chek the object');
        assert.equal(res.name, name, 'check the name');
        assert.equal(res.interval, interval, 'check the interval');
        assert.equal(res.test, option, 'check the option');
      });
    });

    describe('.get()', function () {
      it('should get the task', async function () {
        const name = 'test';
        const interval = 2;
        const option = 2;
        const res = await task.get(name);
        assert.isObject(res, 'chek the object');
        assert.equal(res.name, name, 'check the name');
        assert.equal(res.interval, interval, 'check the interval');
        assert.equal(res.test, option, 'check the option');
      });

      it('should not get the wrong task', async function () {
        assert.isNull(await task.get('wrong'));
      });
    });

    describe('.remove()', function () {
      it('should remove the task', async function () {
        const name = 'test';
        await task.remove(name);
        assert.isNull(await task.get(name));
      });
    });

    describe('.start()', function () {
      it('should start the task', async function () {
        const res = await task.add('test', 1, () => { });
        assert.isTrue(res.isStopped, 'check the status before');
        await task.start(res);
        assert.isFalse(res.isStopped, 'check the status after');
      });
    });

    describe('.stop()', function () {
      it('should stop the task', async function () {
        const res = await task.get('test');
        assert.isFalse(res.isStopped, 'check the status before');
        await task.stop(res);
        assert.isTrue(res.isStopped, 'check the status after');
      });
    });

    describe('.run()', function () {
      it('should run the task callback', async function () {
        let counter = 0;
        const res = await task.add('test', 1, () => counter++);
        await task.start(res);
        await task.run(res);
        assert.equal(counter, 1, 'check the function calling');
      });
    });

    describe('blocking', function () {
      it('should block the task', async function () {
        let counter = 0;
        let interval = 100;
        const res = await task.add('test', interval, async () => (await tools.wait(interval), counter++));
        await task.start(res);
        await Promise.all([task.run(res), task.run(res)]);
        assert.equal(counter, 1, 'check after the first iteration');
        await task.run(res);
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