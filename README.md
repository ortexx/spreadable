# [Spreadable](https://github.com/ortexx/spreadable/) [alpha]

Spreadable is a simple decentralized distributed network mechanism.
You can use it to combine servers in a public or private network for any purpose. The library consists of two parts:

```javascript
// Server
const Node = require('spreadable').Node;

(async () => {  
  try {
    const node = new Node({
      port: 4000,
      hostname: 'localhost',
      initialNetworkAddress: 'localhost:4000',      
    });
    await node.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
}})();
```


```javascript
// Client
const Client = require('spreadable').Client;

(async () => {  
  try {
    const client = new Client({
      address: 'localhost:4000'
    });
    await client.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
}})();
```

In the example above, we run a node, and then we connected to it through the client in order to perform some actions in the future. Let's add another node to our local network.

```javascript  
// Another server
const Node = require('spreadable').Node;

(async () => {  
  try {
    const node = new Node({
      port: 4001,
      hostname: 'localhost',
      initialNetworkAddress: 'localhost:4000'
    });
    await node.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

In order to join to an already existing network, you need to pass __initialNetworkAddress__ option containing the address of any of the network's active node. If you are launching the very first server, then simply indicate in the option a link to yourself, as was done at the very beginning. Now you can add to the network the number of nodes you need. The client can use the address of any active network node to connect to the network itself.

```javascript
const Client = require('spreadable').Client;

(async () => {  
  try {
    const client = new Client({
      address: 'localhost:4001'
    });
    await client.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

## How the network works
For the network working, all nodes must be able to communicate with each other. Requests are made via the http(s) protocol. The network is p2p, but the nodes are conditionally divided into masters and slaves. From the point of view of rights, there is no difference between them. Masters only additionally maintain some lists for grouping servers and register new members. The network is designed in such a way that at any time a new member can join it, or the old one will leave, including the masters. After a while, another server will take over this role.

## How nodes distinguish each other
The node ID is called __address__ and written as __hostname:port__. Hostname might be a domain name or ip address. For ipv6 it is __[ip]:port__. By default, the server tries to get its external ip. If the computer is not connected to the Internet, then it will use the local ip address. Or you can always pass the __hostname__ as option manually. If the node address changes, then it is simply re-registering on the network.

## How exactly the library can be used
You can extend the library code and add various interesting features. For example, the [storacle](https://github.com/ortexx/storacle/) organizes file storage using the protocol.

## How to use https

### 1. Use trusted ssl certificates. 
Suppose you have a certificate for all __example.com__ subdomains

```javascript
const Node = require('spreadable').Node;

(async () => {  
  try {
    for(let i = 1; i < 10; i++) {
      const node = new Node({
        port: 80,
        initialNetworkAddress: 'sub1.example.com:80',
        hostname: `sub${i}.example.com`,
        server: {
          https: true
        }
      });
      await node.init();
    }    
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

```javascript
const Client = require('spreadable').Client;

(async () => {  
  try {
    const client = new Client({
      address: 'sub1.example.com:80',
      https: true
    });
    await client.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

So, we have 9 servers that interact through https

### 2. Use self-signed certificates. 
You can also create a self-signed certificate, and use an authentication certificate to make requests. To simplify the example, suppose that one certificate simultaneously contains the addresses of all network nodes.

```javascript
const Node = require('spreadable').Node;
const fs = require('fs');
const key = fs.readFileSync('key.pem');
const cert = fs.readFileSync('cert.pem');
const ca = fs.readFileSync('ca.pem');

(async () => {  
 
  try {
    for(let i = 1; i < 10; i++) {
      const node = new Node({
        port: 4000 + i,
        hostname: 'localhost',
        initialNetworkAddress: 'localhost:4001',
        server: {
          https: {
            key, 
            cert,
            ca
          }
        }
      });
      await node.init();
    }    
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

```javascript
const Client = require('spreadable').Client;
const fs = require('fs');
const ca = fs.readFileSync('ca.pem');

(async () => {  
  try {
    const client = new Client({
      address: 'localhost:4001',
      https: {
        ca
      }
    });
    await client.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```
Don't forget to pass the authentication certificate in this case.

## How to create a private network

### 1. Use a secret key

```javascript
const Node = require('spreadable').Node;
const sercretKey = 'mySecretKey';

(async () => {  
  try {
    const node = new Node({
      port: 4000,
      hostname: 'localhost',
      initialNetworkAddress: 'localhost:4000',
      network: {
        sercretKey
      }
    });
    await node.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

```javascript
const Client = require('spreadable').Client;
const sercretKey = 'mySecretKey';

(async () => {  
  try {
    const client = new Client({
      address: 'localhost:4000',
      sercretKey
    });
    await client.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

### 2. Use your own network access filter

```javascript
const Node = require('spreadable').Node;
const db = require('some-db');
const errors = require('spreadable/src/errors');

class MyNode extends Node {
  networkAccess(req) {
    super.networkAccess(req);

    // we can do any check we want here
    if(!await db.AllowedIpAddresses.count(req.clientIp)) {
      throw new errors.AccessError('You ip address is denied');
    }
  }
}

(async () => {  
  try {
    const node = new MyNode({
      port: 4000,
      hostname: 'localhost',
      initialNetworkAddress: 'localhost:4000'
    });
    await node.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
}})();
```

```javascript
const Client = require('spreadable').Client;

(async () => {  
  try {
    const client = new Client({
      address: 'localhost:4000'
    });
    await client.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

In both cases, the network is closed, but not completely secure. If we use http protocol, the data transferred is not encrypted. In some cases this is a suitable option, otherwise you need to use https.
