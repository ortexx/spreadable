const assert = require('chai').assert;
const fetch = require('node-fetch');
const Node = require('../src/node')();
const Client = require('../src/client')();
const utils = require('../src/utils');
const schema = require('../src/schema');
const tools = require('./tools');

describe('routes', () => {
  let node;
  let client;

  before(async function() {
    node = new Node(await tools.createNodeOptions({ 
      network: { 
        auth: { username: 'username', password: 'password' }
      } 
    }));
    await node.init();
    client = new Client(await tools.createClientOptions({ 
      address: node.address, 
      auth: { username: 'username', password: 'password' }
    }));
    await client.init();
  });

  after(async function() {
    await node.deinit();
    await client.deinit();
  });
  describe('/ping', function () {
    it('should return the right address', async function () { 
      const res = await fetch(`http://${node.address}/ping`);
      assert.equal((await res.json()).address, node.address);
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

  describe('/members', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/members`);
      assert.equal(await res.status, 401);
    });

    it('should return the members', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/members`, options);
      const json = await res.json();

      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getMembersResponse(), json);
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

  describe('/api/master/walk', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/api/master/walk`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a master acception error', async function () { 
      const res = await fetch(`http://${node.address}/api/master/walk`, node.createDefaultRequestOptions());
      assert.equal(await res.status, 422);
    });

    it('should return a success message', async function () { 
      const body = { ignoreAcception: true };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/api/master/walk`, options);
      assert.isTrue((await res.json()).success);
    });
  });

  describe('/api/node/register', function () {
    let targetNode;

    before(async () => {
      targetNode = new Node(await tools.createNodeOptions({ network: node.options.network }));
      await targetNode.init();
    });

    after(async () => {
      await targetNode.deinit();
    })

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

  describe('/api/node/provide-structure', function () {
    let body;

    before(function () {
      body = { 
        target: node.address,
        timeout: 1000,
        timestamp: Date.now() 
      };
    });

    it('should return an auth error', async function () { 
      const options = tools.createJsonRequestOptions({ body });         
      const res = await fetch(`http://${node.address}/api/node/provide-structure`, options);
      assert.equal(await res.status, 401);
    });

    it('should return the right schema', async function () {
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/api/node/provide-structure`, options);      
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getProvideStructureResponse(), json);
      });
    });
  });

  describe('/api/node/provide-group-structure', function () {
    let body;

    before(function () {
      body = { 
        target: node.address,
        timeout: 1000,
        timestamp: Date.now() 
      };
    });

    it('should return an auth error', async function () { 
      const options = tools.createJsonRequestOptions({ body });         
      const res = await fetch(`http://${node.address}/api/node/provide-group-structure`, options);
      assert.equal(await res.status, 401);
    });

    it('should return the right schema', async function () {
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/api/node/provide-group-structure`, options);      
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getProvideGroupStructureResponse(), json);
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