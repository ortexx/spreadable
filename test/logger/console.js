import { assert } from "chai";
import loggerConsole from "../../src/logger/transports/console/index.js";

const LoggerConsole = loggerConsole();

export default function () {
  describe('LoggerConsole', function () {
    let logger;
    let fn;
    let status;
    let levels;

    before(() => {
      status = {};
      fn = {};
      levels = ['info', 'warn', 'error'];

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        status[level] = 0;
        //eslint-disable-next-line no-console
        fn[level] = console[level], console[level] = () => status[level]++;
      }
    });

    after(() => {
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        //eslint-disable-next-line no-console   
        console[level] = fn[level];
      }
    });

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => logger = new LoggerConsole());
        logger.node = this.node;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await logger.init();
      });
    });

    describe('.info()', function () {
      it('should not increment', async function () {
        logger.level = 'warn';
        await logger.info('test info');
        assert.equal(status['info'], 0);
      });

      it('should increment', async function () {
        logger.level = 'info';
        await logger.info('test info');
        assert.equal(status['info'], 1);
      });
    });

    describe('.warn()', function () {
      it('should not increment', async function () {
        logger.level = 'error';
        await logger.info('test warn');
        assert.equal(status['warn'], 0);
      });

      it('should increment', async function () {
        logger.level = 'warn';
        await logger.warn('test warn');
        assert.equal(status['warn'], 1);
      });
    });

    describe('.error()', function () {
      it('should not increment', async function () {
        logger.level = false;
        await logger.info('test warn');
        assert.equal(status['error'], 0);
      });

      it('should increment', async function () {
        logger.level = 'error';
        await logger.error('test error');
        assert.equal(status['error'], 1);
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await logger.deinit();
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        await logger.init();
      });
    });
    
    describe('.destroy()', function () {
      it('should not throw an exception', async function () {
        await logger.destroy();
      });
    });
  });
}