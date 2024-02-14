import { assert } from "chai";
import client from "../../src/approval/transports/client/index.js";
import utils from "../../src/utils.js";

const ApprovalClient = client();

export default function () {
  describe('ApprovalClient', () => {
    let approval;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => approval = new ApprovalClient());
        approval.node = this.node;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await approval.init();
      });
    });

    describe('.createInfo()', function () {
      it('should return the right info', async function () {
        const clientIp = '127.0.0.1';
        const result = await approval.createInfo({ clientIp });
        assert.isOk(result.info == clientIp && result.answer == clientIp);
      });
    });

    describe('.createQuestion()', function () {
      it('should return the right question', async function () {
        const clientIp = '127.0.0.1';
        const result = await approval.createQuestion([], undefined, clientIp);
        assert.equal(result, clientIp);
      });
    });

    describe('.checkAnswer()', function () {
      it('should return false', async function () {
        const clientIp = '127.0.0.1';
        const result = await approval.checkAnswer({ answer: clientIp }, '1.1.1.1');
        assert.isFalse(result);
      });

      it('should return true', async function () {
        const clientIp = '127.0.0.1';
        const result = await approval.checkAnswer({ answer: clientIp }, clientIp);
        assert.isTrue(result);
      });
    });
    describe('.getClientInfoSchema()', function () {
      it('should throw an error', function () {
        const schema = approval.getClientInfoSchema();
        assert.throws(() => utils.validateSchema(schema, {}));
      });

      it('should not throw an error', function () {
        const schema = approval.getClientInfoSchema();
        assert.doesNotThrow(() => utils.validateSchema(schema, undefined));
      });
    });

    describe('.getClientAnswerSchema()', function () {
      it('should throw an error', function () {
        const schema = approval.getClientAnswerSchema();
        assert.throws(() => utils.validateSchema(schema, 'wrong'));
      });

      it('should not throw an error', function () {
        const schema = approval.getClientAnswerSchema();
        assert.doesNotThrow(() => utils.validateSchema(schema, '1.1.1.1'));
      });
    });

    describe('.getApproverInfoSchema()', function () {
      it('should throw an error', function () {
        const schema = approval.getApproverInfoSchema();
        assert.throws(() => utils.validateSchema(schema, 'wrong'));
      });

      it('should not throw an error', function () {
        const schema = approval.getApproverInfoSchema();
        assert.doesNotThrow(() => utils.validateSchema(schema, '1.1.1.1'));
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