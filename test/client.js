import { assert } from "chai";
import node from "../src/node.js";
import client from "../src/client.js";
import approvalClient from "../src/approval/transports/client/index.js";
import tools from "./tools.js";

const Node = node();
const Client = client();
const ApprovalClient = approvalClient();

export default function () {
  describe('Client', () => {
    let client;
    let node;

    before(async function () {
      node = new Node(await tools.createNodeOptions());
      await node.addApproval('test', new ApprovalClient());
      await node.init();
    });

    after(async function () {
      await node.deinit();
    });

    describe('instance creation', function () {
      it('should create an instance', async function () {
        const options = await tools.createClientOptions({ address: node.address });
        assert.doesNotThrow(() => client = new Client(options));
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await client.init();
      });
      
      it('should set the worker address', async function () {
        assert.equal(client.workerAddress, node.address);
      });
    });

    describe('.getApprovalQuestion()', () => {
      it('should return approval info', async () => {
        const info = await client.getApprovalQuestion('test');
        assert.isDefined(info.question);
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await client.deinit();
      });
    });
  });
}