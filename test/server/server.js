import { assert } from "chai";
import fetch from "node-fetch";
import https from "https";
import server from "../../src/server/transports/server/index.js";
import utils from "../../src/utils.js";
import * as selfsigned from "selfsigned";

const Server = server();

export default function () {
  describe('Server', () => {
    let server;
    let nodeServer;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => server = new Server());
        server.node = this.node;
        nodeServer = this.node.server;
        this.node.server = server;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await server.init();
      });

      it('should ping to the server', async function () {
        const res = await fetch(`http://${this.node.address}`);
        assert.equal(res.status, 200);
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await server.deinit();
      });

      it('should not ping to the server', async function () {
        assert.isFalse(await utils.isPortUsed(this.node.port));
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        const pems = selfsigned.generate();
        server.options.https = { key: pems.private, cert: pems.cert, ca: pems.clientcert };
        await server.init();
      });

      it('should ping to the server', async function () {
        const agent = new https.Agent({ rejectUnauthorized: false });
        const res = await fetch(`https://${this.node.address}`, { agent });
        assert.equal(res.status, 200);
      });
    });

    describe('.destroy()', function () {
      it('should not throw an exception', async function () {
        await server.destroy();
        this.node.server = nodeServer;
      });
      
      it('should not ping to the server', async function () {
        assert.isFalse(await utils.isPortUsed(this.node.port));
      });
    });
  });
}