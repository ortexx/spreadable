import { assert } from "chai";
import approval from "../../src/approval/transports/approval/index.js";

const Approval = approval();

export default function () {
  describe('Approval', () => {
    let approval;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => approval = new Approval());
        approval.node = this.node;
      });

      it('should create the default properties', function () {
        assert.containsAllKeys(approval, ['approversCount', 'decisionLevel', 'period']);
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await approval.init();
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await approval.deinit();
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        await approval.init();
      });
    });
    
    describe('.destroy()', function () {
      it('should not throw an exception', async function () {
        await approval.destroy();
      });
    });
  });
}