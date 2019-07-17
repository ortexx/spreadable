const assert = require('chai').assert;
const Service = require('../src/service')();

describe('Service', () => {
  let service;

  describe('instance creation', () => {
    it('should create an instance', async () => { 
      assert.doesNotThrow(() => service = new Service());
    });
  });

  describe('.init()', () => {
    it('should initialize the service', async () => {
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