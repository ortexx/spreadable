const assert = require('chai').assert;
const Database = require('../../src/db/transports/database')();

describe('Database', () => {
  let db;
  
  describe('instance creation', function () {
    it('should create an instance', function () {
      assert.doesNotThrow(() => db = new Database(this.node));
    });
  });

  describe('.init()', function () { 
    it('should not throw an exception', async function () {
      await db.init();
    });  
  });

  describe('.deinit()', function () { 
    it('should not throw an exception', async function () {
      await db.deinit();
    });
  }); 

  describe('reinitialization', () => {
    it('should not throw an exception', async function () {
      await db.init();
    });
  });
  
  describe('.destroy()', function () { 
    it('should not throw an exception', async function () {
      await db.destroy();
    });
  });
});