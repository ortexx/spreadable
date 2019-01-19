const assert = require('chai').assert;
const path = require('path');
const _ = require('lodash');
const Node = require('../src/node')();
const getPort = require('get-port');

describe('Node', () => {
  describe('Instance creation', () => {
    let port;
    let initialNetworkAddress;
    let defaultOptions;

    before(async () => {   
      port = await getPort();      
      initialNetworkAddress = `localhost:${port}`;
      defaultOptions = {
        hostname: 'localhost',
        db: {
          storage: path.join(process.cwd(), 'test', 'spreadable', `storage-${port}`)
        }
      };      
    });

    it('should create an instance', () => {
      assert.doesNotThrow(() => new Node(_.merge({}, defaultOptions, { port, initialNetworkAddress })));
    });
  });
});