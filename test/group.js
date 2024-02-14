import { assert } from "chai";
import node from "../src/node.js";
import client from "../src/client.js";
import approvalClient from "../src/approval/transports/client/index.js";
import captcha from "../src/approval/transports/captcha/index.js";
import express from "../src/server/transports/express/index.js";
import midds from "../src/server/transports/express/midds.js";
import tools from "./tools.js";

const NodeBase = node();
const Client = client();
const ApprovalClient = approvalClient();
const ApprovalCaptcha = captcha();
const ServerExpress = express();

const routes = [
  {
    name: "approvalClientTest",
    method: "post",
    url: "/approval-client-test",
    fn: (node) => [
      midds.approval(node),
      (req, res) => res.send({ success: true }),
    ],
  },
  {
    name: "approvalCaptchaTest",
    method: "post",
    url: "/approval-captcha-test",
    fn: (node) => [
      midds.approval(node),
      (req, res) => res.send({ success: true }),
    ],
  },
];

class ServerExpressTest extends ServerExpress {
  getMainRoutes() {
    const arr = super.getMainRoutes();
    arr.splice(
      arr.findIndex((r) => r.name == "ping"),
      0,
      ...routes.slice()
    );
    return arr;
  }
}

class Node extends NodeBase {
  static get ServerTransport() {
    return ServerExpressTest;
  }
}

export default function () {
  describe("group communication", () => {
    let nodes;
    let client;

    before(async () => {
      nodes = [];
      nodes.push(new Node(await tools.createNodeOptions()));
      nodes.push(
        new Node(
          await tools.createNodeOptions({
            initialNetworkAddress: [`localhost:${nodes[0].port}`],
          })
        )
      );
    });

    after(async () => {
      for (let i = 0; i < nodes.length; i++) {
        await nodes[i].deinit();
      }
    });

    it("should register two nodes", async () => {
      await nodes[0].init();
      await nodes[0].sync();
      await nodes[1].init();
      await nodes[1].sync();
      assert.isTrue(
        await nodes[0].db.hasSlave(nodes[1].address),
        "check the second node registration as slave"
      );
      assert.ok(
        await nodes[1].db.getBacklink(nodes[0].address),
        "check the first node registration as backlink"
      );
      assert.ok(
        await nodes[1].db.getMaster(nodes[0].address),
        "check the first node registration as master"
      );
    });

    it("should reregister node", async () => {
      nodes.push(new Node(await tools.createNodeOptions()));
      await nodes[2].init();
      nodes[1].initialNetworkAddress = nodes[2].address;
      await tools.wait(await nodes[1].getSyncLifetime());
      await nodes[0].sync();
      await nodes[2].sync();
      await nodes[1].sync();
      assert.equal(
        (await nodes[1].db.getBacklink()).address,
        nodes[2].address,
        "check the new backlink"
      );
      await nodes[0].sync();
      assert.isFalse(
        await nodes[0].db.hasSlave(nodes[1].address),
        "check the slave is removed in the master"
      );
    });

    it("should add the third node to the network", async () => {
      nodes[2].initialNetworkAddress = nodes[0].address;
      await tools.wait(await nodes[1].getSyncLifetime());
      await nodes[0].sync();
      await nodes[2].sync();
      await nodes[1].sync();
      assert.equal(
        (await nodes[2].db.getBacklink()).address,
        nodes[0].address,
        "check the new backlink"
      );
      assert.isTrue(
        await nodes[0].db.hasSlave(nodes[2].address),
        "check the new slave"
      );
    });

    it("should show the right network size", async () => {
      for (let i = 0; i < 2; i++) {
        const node = new Node(
          await tools.createNodeOptions({
            initialNetworkAddress: nodes[i].address,
          })
        );
        nodes.push(node);
        await node.init();
      }
      
      await tools.nodesSync(nodes, nodes.length * 3);

      for (let i = 0; i < nodes.length; i++) {
        assert.equal(await nodes[i].getNetworkSize(), nodes.length);
      }
    });

    it("should remove the node from the network", async () => {
      await nodes[0].deinit();
      nodes.shift();

      for (let i = 0; i < nodes.length; i++) {
        nodes[i].initialNetworkAddress = nodes[0].address;
      }

      await tools.wait(await nodes[0].getSyncLifetime());
      await tools.nodesSync(nodes, nodes.length * 3);
      await tools.wait(await nodes[0].getSyncLifetime());
      await tools.nodesSync(nodes, nodes.length * 3);

      for (let i = 0; i < nodes.length; i++) {
        assert.equal(await nodes[i].getNetworkSize(), nodes.length);
      }
    });

    it("should prepare node and client for requests", async () => {
      for (let i = 0; i < nodes.length; i++) {
        await nodes[i].addApproval("client", new ApprovalClient());
        await nodes[i].addApproval("captcha", new ApprovalCaptcha());
        await nodes[i].sync();
      }

      client = new Client( await tools.createClientOptions({ address: nodes[0].address }));
      await client.init();
    });

    it("should not approve client requests", async () => {
      try {
        await nodes[0].requestServer(nodes[0].address, "approval-client-test");
        throw new Error("fail");
      } catch (err) {
        assert.isTrue(err.code == "ERR_SPREADABLE_APPROVAL_INFO_REQUIRED");
      }
    });

    it("should approve client requests", async () => {
      const approvalInfo = await client.getApprovalQuestion("client");
      approvalInfo.answer = approvalInfo.question;
      delete approvalInfo.question;
      const result = await nodes[0].requestServer(
        nodes[0].address,
        "approval-client-test",
        { body: { approvalInfo } }
      );
      assert.isTrue(result.success);
    });

    it("should not approve captcha requests", async () => {
      try {
        await nodes[0].requestServer(nodes[0].address, "approval-captcha-test");
        throw new Error("fail");
      } catch (err) {
        assert.isTrue(err.code == "ERR_SPREADABLE_APPROVAL_INFO_REQUIRED");
      }
    });

    it("should approve captcha requests", async () => {
      const approval = await nodes[0].getApproval("captcha");
      const approvalInfo = await client.getApprovalQuestion("captcha");
      const approvers = approvalInfo.approvers;
      const answers = {};

      for (let i = 0; i < nodes.length; i++) {
        const info = await nodes[i].db.getApproval(approvalInfo.key);
        answers[nodes[i].address] = info.answer;
      }

      let length = approval.captchaLength;
      let answer = "";

      for (let i = 0; i < approvers.length; i++) {
        const address = approvers[i];
        const count = Math.floor(length / (approvers.length - i));
        answer += answers[address].slice(0, count);
        length -= count;
      }

      approvalInfo.answer = answer;
      delete approvalInfo.question;
      const result = await nodes[0].requestServer(
        nodes[0].address,
        "approval-captcha-test",
        { body: { approvalInfo } }
      );
      assert.isTrue(result.success);
    });
  });
}
