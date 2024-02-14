import { assert } from "chai";
import server from "../../src/server/transports/express/index.js";

const ServerExpress = server();

export default function () {
  describe('ServerExpress', () => {
    let server;
    let nodeServer;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => server = new ServerExpress());
        server.node = this.node;
        nodeServer = this.node.server;
        this.node.server = server;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await server.init();
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await server.deinit();
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        await server.init();
      });
    });
    
    describe('.destroy()', function () {
      it('should not throw an exception', async function () {
        await server.destroy();
        this.node.server = nodeServer;
      });
    });
  });
}