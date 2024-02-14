import { assert } from "chai";
import adapter from "../../src/logger/transports/adapter/index.js";
import logger from "../../src/logger/transports/logger/index.js";
import transports from "../../src/logger/index.js";

const LoggerAdapter = adapter();
const Logger = logger();

class LoggerInterface extends Logger {
  constructor() {
    super(...arguments);
    this.infoCounter = 0;
    this.warnCounter = 0;
    this.errorCounter = 0;
    this.initCounter = 0;
    this.deinitCounter = 0;
    this.destroyCounter = 0;
  }

  async log(level) {    
    this[level + 'Counter']++;
  }

  async init() {
    this.initCounter++;
  }

  async deinit() {
    this.deinitCounter++;
  }

  async destroy() {
    this.destroyCounter++;
  }
}

transports.LoggerInterface = LoggerInterface;

export default function () {
  describe('LoggerConsole', function () {
    let logger;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => logger = new LoggerAdapter({
          transports: [
            { transport: LoggerInterface, options: { x: 1 } },
            { transport: 'LoggerInterface', options: { x: 2 } }
          ]
        }));
        logger.node = this.node;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await logger.init();
      });

      it('should add two transports', async function () {
        assert.equal(logger.transports.length, 2);
      });

      it('should add the transport options', async function () {
        assert.equal(logger.transports[0].options.x, 1, 'check the first');
        assert.equal(logger.transports[1].options.x, 2, 'check the second');
      });

      it('should increment', async function () {
        assert.equal(logger.transports[0].initCounter, 1, 'check the first');
        assert.equal(logger.transports[1].initCounter, 1, 'check the second');
      });
    });

    describe('.info()', function () {
      it('should not increment', async function () {
        logger.level = 'warn';
        await logger.info();
        assert.equal(logger.transports[0].infoCounter, 0, 'check the first');
        assert.equal(logger.transports[1].infoCounter, 0, 'check the second');
      });

      it('should increment', async function () {
        logger.level = 'info';
        await logger.info();
        assert.equal(logger.transports[0].infoCounter, 1, 'check the first');
        assert.equal(logger.transports[1].infoCounter, 1, 'check the second');
      });
    });

    describe('.warn()', function () {
      it('should not increment', async function () {
        logger.level = 'error';
        await logger.info();
        assert.equal(logger.transports[0].warnCounter, 0, 'check the first');
        assert.equal(logger.transports[1].warnCounter, 0, 'check the second');
      });

      it('should increment', async function () {
        logger.level = 'warn';
        await logger.warn();
        assert.equal(logger.transports[0].warnCounter, 1, 'check the first');
        assert.equal(logger.transports[1].warnCounter, 1, 'check the second');
      });
    });

    describe('.error()', function () {
      it('should not increment', async function () {
        logger.level = false;
        await logger.info();
        assert.equal(logger.transports[0].errorCounter, 0, 'check the first');
        assert.equal(logger.transports[1].errorCounter, 0, 'check the second');
      });

      it('should increment', async function () {
        logger.level = 'error';
        await logger.error();
        assert.equal(logger.transports[0].errorCounter, 1, 'check the first');
        assert.equal(logger.transports[1].errorCounter, 1, 'check the second');
      });
    });

    describe('.addTransport()', function () {
      it('should add a new transport', async function () {
        logger.addTransport(new LoggerInterface({ x: 3 }));
        assert.equal(logger.transports[2].options.x, 3);
      });
    });

    describe('.removeTransport()', function () {
      it('should add a new transport', async function () {
        logger.removeTransport(logger.transports[2]);
        assert.isUndefined(logger.transports[2]);
      });
    });

    describe('.deinit()', function () {
      let first;
      let second;

      before(function () {
        first = logger.transports[0];
        second = logger.transports[1];
      });

      it('should not throw an exception', async function () {
        await logger.deinit();
      });

      it('should remove transports', async function () {
        assert.lengthOf(logger.transports, 0);
      });

      it('should increment', async function () {
        assert.equal(first.deinitCounter, 1, 'check the first');
        assert.equal(second.deinitCounter, 1, 'check the second');
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        await logger.init();
      });
      it('should increment', async function () {
        assert.equal(logger.transports[0].initCounter, 1, 'check the first');
        assert.equal(logger.transports[1].initCounter, 1, 'check the second');
      });
    });

    describe('.destroy()', function () {
      let first;
      let second;

      before(function () {
        first = logger.transports[0];
        second = logger.transports[1];
      });

      it('should not throw an exception', async function () {
        await logger.destroy();
      });
      
      it('should increment', async function () {
        assert.equal(first.destroyCounter, 1, 'check the first');
        assert.equal(second.destroyCounter, 1, 'check the second');
      });
    });
  });
}