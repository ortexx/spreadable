import { assert } from "chai";
import fetch from "node-fetch";
import node from "../src/node.js";
import client from "../src/client.js";
import approvalClient from "../src/approval/transports/client/index.js";
import utils from "../src/utils.js";
import schema from "../src/schema.js";
import tools from "./tools.js";

const Node = node();
const Client = client();
const ApprovalClient = approvalClient();

export default function () {
  describe('routes', () => {
    let node;
    let client;

    before(async function () {
      node = new Node(await tools.createNodeOptions({
        network: {
          auth: { username: 'username', password: 'password' }
        }
      }));
      await node.addApproval('test', new ApprovalClient());
      await node.init();
      await node.sync();
      client = new Client(await tools.createClientOptions({
        address: node.address,
        auth: { username: 'username', password: 'password' }
      }));
      await client.init();
    });

    after(async function () {
      await node.deinit();
      await client.deinit();
    });

    describe('/ping', function () {
      it('should return the right address', async function () {
        const res = await fetch(`http://${node.address}/ping`);
        const json = await res.json();
        assert.equal(json.address, node.address);
        assert.equal(json.version, node.getVersion());
      });
    });

    describe('/status', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/status`);
        assert.equal(await res.status, 401);
      });

      it('should return the status', async function () {
        const options = client.createDefaultRequestOptions({ method: 'get' });
        const res = await fetch(`http://${node.address}/status`, options);
        const json = await res.json();
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getStatusResponse(), json);
        });
      });

      it('should return the pretty status', async function () {
        const options = client.createDefaultRequestOptions({ method: 'get' });
        const res = await fetch(`http://${node.address}/status?pretty`, options);
        const json = await res.json();
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getStatusPrettyResponse(), json);
        });
      });
    });

    describe('/client/get-available-node', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/get-available-node`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return the node address', async function () {
        const options = client.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/client/get-available-node`, options);
        const json = await res.json();
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getAvailableNodeResponse(), json);
        });
      });
    });

    describe('/client/request-approval-key', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/request-approval-key`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = client.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/client/request-approval-key`, options);
        assert.equal(res.status, 422);
      });

      it('should return the right schema', async function () {
        const body = { action: 'test' };
        const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/client/request-approval-key`, options);
        const json = await res.json();
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getRequestApprovalKeyResponse(), json);
        });
      });
    });

    describe('/client/add-approval-info', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/add-approval-info`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = client.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/client/add-approval-info`, options);
        assert.equal(res.status, 422);
      });

      it('should return the success message', async function () {
        const approval = await node.getApproval('test');
        const body = {
          action: 'test',
          key: 'key',
          startedAt: utils.getClosestPeriodTime(Date.now(), approval.period)
        };
        const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/client/add-approval-info`, options);
        const json = await res.json();
        assert.isTrue(json.success);
      });
    });

    describe('/client/request-approval-question', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/client/request-approval-question`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = client.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/client/request-approval-question`, options);
        assert.equal(res.status, 422);
      });

      it('should return the question', async function () {
        const body = {
          action: 'test',
          key: 'key',
          confirmedAddresses: [node.address]
        };
        const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/client/request-approval-question`, options);
        const json = await res.json();
        assert.isDefined(json.question);
      });
    });

    describe('/api/node/get-approval-info', function () {
      it('should return an auth error', async function () {
        const options = tools.createJsonRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/get-approval-info`, options);
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = node.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/get-approval-info`, options);
        assert.equal(res.status, 422);
      });

      it('should return the info', async function () {
        const body = {
          action: 'test',
          key: 'key'
        };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/api/node/get-approval-info`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.isDefined(json.info);
      });
    });

    describe('/api/node/check-approval-answer', function () {
      it('should return an auth error', async function () {
        const options = tools.createJsonRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/check-approval-answer`, options);
        assert.equal(await res.status, 401);
      });

      it('should return a data error', async function () {
        const options = node.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/check-approval-answer`, options);
        assert.equal(res.status, 422);
      });

      it('should return the success message', async function () {
        const approver = await node.db.getApproval('key');
        const body = {
          action: 'test',
          key: 'key',
          clientIp: approver.clientIp,
          approvers: [node.address],
          answer: approver.answer
        };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/api/node/check-approval-answer`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.isTrue(json.success);
      });
    });

    describe('/api/node/register', function () {
      let targetNode;
      before(async () => {
        targetNode = new Node(await tools.createNodeOptions({
          initialNetworkAddress: node.address,
          network: node.options.network
        }));
        await targetNode.init();
        await targetNode.sync();
      });

      after(async () => {
        await targetNode.deinit();
      });

      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/api/node/register`, { method: 'post' });
        assert.equal(await res.status, 401);
      });

      it('should return an interview error', async function () {
        const body = { target: 'localhost:1' };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/api/node/register`, options);
        assert.equal(await res.status, 422);
      });

      it('should return the right schema', async function () {
        const body = { target: targetNode.address };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/api/node/register`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getRegisterResponse(), json);
        });
      });
    });

    describe('/api/node/structure', function () {
      it('should return an auth error', async function () {
        const options = tools.createJsonRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/structure`, options);
        assert.equal(await res.status, 401);
      });

      it('should return the right schema', async function () {
        const options = node.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/structure`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getStructureResponse(), json);
        });
      });
    });

    describe('/api/node/get-interview-summary', function () {
      it('should return an auth error', async function () {
        const options = tools.createJsonRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/get-interview-summary`, options);
        assert.equal(await res.status, 401);
      });

      it('should return the right schema', async function () {
        const options = node.createDefaultRequestOptions();
        const res = await fetch(`http://${node.address}/api/node/get-interview-summary`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getInterviewSummaryResponse(), json);
        });
      });
    });

    describe('/api/node/provide-registration', function () {
      it('should return an auth error', async function () {
        const res = await fetch(`http://${node.address}/api/node/provide-registration`, { method: 'post' });
        assert.equal(await res.status, 401);
      });
      
      it('should return the right schema', async function () {
        const body = { target: node.address };
        const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
        const res = await fetch(`http://${node.address}/api/node/provide-registration`, options);
        const json = tools.createServerResponse(node.address, await res.json());
        assert.doesNotThrow(() => {
          utils.validateSchema(schema.getProvideRegistrationResponse(), json);
        });
      });
    });
  });
}