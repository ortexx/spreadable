const assert = require('chai').assert;
const path = require('path');
const _ = require('lodash');
const Node = require('../src/node')();
const getPort = require('get-port');
const fse = require('fs-extra');
const tmpPath = path.join(__dirname, 'tmp');

describe('Node', () => {
  before(() => {
    return fse.ensureDir(tmpPath);
  });

  after(() => {
    return fse.remove(tmpPath);
  });

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
          filename: path.join(tmpPath, `loki-${port}.db`)
        }
      };
    });

    it('should not create an instance because of port', () => {
      assert.throws(() => new Node(_.merge({}, defaultOptions, { initialNetworkAddress })));
    });

    it('should not create an instance because of initialNetworkAddress', () => {
      assert.throws(() => new Node(_.merge({}, defaultOptions, { port })));
    });

    it('should create an instance', () => {
      assert.doesNotThrow(() => new Node(_.merge({}, defaultOptions, { port, initialNetworkAddress })));
    });
  });
});