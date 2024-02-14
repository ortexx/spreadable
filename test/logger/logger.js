import { assert } from "chai";
import logger from "../../src/logger/transports/logger/index.js";

const Logger = logger();

export default function () {
  describe('Logger', () => {
    let logger;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => logger = new Logger());
        logger.node = this.node;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await logger.init();
      });
    });

    describe('.setLevel()', function () {
      it('should set the level', function () {
        const level = 'warn';
        assert.equal(logger.level, logger.defaultLevel, 'check before');
        logger.setLevel(level);
        assert.equal(logger.level, level, 'check before');
      });

      it('should throw an error with wrong level', function () {
        assert.throws(() => logger.setLevel('wrong'));
      });

      it('should set the false', function () {
        logger.setLevel(false);
        assert.isFalse(logger.level);
      });
    });

    describe('.isLevelActive()', function () {
      it('should check the false level', function () {
        logger.isLevelActive('warn', 'check warn');
        logger.isLevelActive('info', 'check info');
        logger.isLevelActive('error', 'check error');
      });

      it('should check the info level', function () {
        logger.setLevel('info');
        assert.isTrue(logger.isLevelActive('info'), 'check info');
        assert.isTrue(logger.isLevelActive('warn'), 'check warn');
        assert.isTrue(logger.isLevelActive('error'), 'check error');
      });

      it('should check the warn level', function () {
        logger.setLevel('warn');
        assert.isFalse(logger.isLevelActive('info'), 'check info');
        assert.isTrue(logger.isLevelActive('warn'), 'check warn');
        assert.isTrue(logger.isLevelActive('error'), 'check error');
      });
      
      it('should check the error level', function () {
        logger.setLevel('error');
        assert.isFalse(logger.isLevelActive('info'), 'check info');
        assert.isFalse(logger.isLevelActive('warn'), 'check warn');
        assert.isTrue(logger.isLevelActive('error'), 'check error');
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