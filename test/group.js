const assert = require('chai').assert;
const Node = require('../src/node')();
const tools = require('./tools');

describe('group communication', () => {
  let nodes;

  before(async () => {
    nodes = [];
    nodes.push(new Node(await tools.createNodeOptions()));
    nodes.push(new Node(await tools.createNodeOptions({ initialNetworkAddress: `localhost:${nodes[0].port}` })));
  });

  after(async () => {
    for(let i = 0; i < nodes.length; i++) {
      await nodes[i].deinit();
    }
  });

  it('should register two nodes', async () => {
    await nodes[0].init();
    await nodes[1].init();
    await nodes[1].sync();
    assert.isTrue(await nodes[0].db.hasSlave(nodes[1].address), 'check the second node registration as slave');
    assert.ok(await nodes[1].db.getBacklink(nodes[0].address), 'check the first node registration as backlink');
    assert.ok(await nodes[1].db.getMaster(nodes[0].address), 'check the first node registration as master');
  });

  it('should reregister node', async () => {
    nodes.push(new Node(await tools.createNodeOptions()));
    await nodes[2].init();
    nodes[1].initialNetworkAddress = nodes[2].address;    
    await tools.wait(await nodes[1].getSyncLifetime());
    await nodes[1].sync();
    assert.equal((await nodes[1].db.getBacklink()).address, nodes[2].address, 'check the new backlink');      
    await nodes[0].sync();
    assert.isFalse(await nodes[0].db.hasSlave(nodes[1].address), 'check the slave is removed in the master');
  });

  it('should add the third node to the network', async () => {
    nodes[2].initialNetworkAddress = nodes[0].address;
    await nodes[2].sync();
    assert.equal((await nodes[2].db.getBacklink()).address, nodes[0].address, 'check the new backlink');
    assert.isTrue(await nodes[0].db.hasSlave(nodes[2].address), 'check the new slave');
  });

  it('should show the right network size', async () => {
    for(let i = 0; i < 2; i++) {
      nodes.push(new Node(await tools.createNodeOptions({ initialNetworkAddress: nodes[i].address })));
      await nodes[nodes.length - 1].init();
    }

    await tools.nodesSync(nodes, nodes.length * 2);

    for(let i = 0; i < nodes.length; i++) {
      assert.equal(await nodes[i].getNetworkSize(), nodes.length);
    }
  });

  it('should remove the node from the network', async () => {
    await nodes[0].deinit();    
    nodes.shift();    

    for(let i = 0; i < nodes.length; i++) {
      nodes[i].initialNetworkAddress = nodes[0].address;
    }
    
    await tools.nodesSync(nodes, nodes.length * 2);

    for(let i = 0; i < nodes.length; i++) {
      assert.equal(await nodes[i].getNetworkSize(), nodes.length);
    }
  });
});