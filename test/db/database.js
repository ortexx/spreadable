import { assert } from "chai";
import database from "../../src/db/transports/database/index.js";

const Database = database();

export default function () {
  describe('Database', () => {
    let db;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => db = new Database());
        db.node = this.node;
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
}