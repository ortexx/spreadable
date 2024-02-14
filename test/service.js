import { assert } from "chai";
import Service from "../src/service.js";

export default function () {
  describe('Service', () => {
    let service;

    describe('instance creation', () => {
      it('should create an instance', async () => {
        assert.doesNotThrow(() => service = new Service());
      });
    });

    describe('.init()', () => {
      it('should not initialize the slave service without registration', async () => {
        try {
          await service.init();
          throw new Error('Fail');
        }
        catch (err) {
          assert.isOk(err.message.match('You have to register'));
        }
      });

      it('should initialize the service', async () => {
        service.__isMasterService = true;
        await service.init();
        assert.typeOf(service.__initialized, 'number');
      });
    });

    describe('.isInitialized()', () => {
      it('should be true', () => {
        assert.isTrue(service.isInitialized());
      });
    });

    describe('.deinit()', () => {
      it('should deinitialize the server', async () => {
        await service.deinit();
        assert.isFalse(service.__initialized);
      });
    });

    describe('.isInitialized()', () => {
      it('should be false', () => {
        assert.isFalse(service.isInitialized());
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async () => {
        await service.init();
        assert.isOk(service.isInitialized());
      });
    });
    
    describe('.destroy()', () => {
      it('should destroy the service', async () => {
        await service.destroy();
        assert.isFalse(service.isInitialized());
      });
    });
  });
}