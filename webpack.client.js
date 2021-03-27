const path = require('path');
const merge = require('lodash/merge');
const config = require('./webpack.common.js');

module.exports = (options = {}, wp) => {
  options = merge({
    name: 'client',
    include: [],
    mock: {
      "fs-extra": true,
      "chalk": true,
      "ip6addr": true,
      "external-ip": true,
      "tcp-port-used": true,
      "validate-ip-node": true,
      "lookup-dns-cache": true,      
      "crypto": true,
      "path": true,
      "stream": true
    }
  }, options); 
  options.include.push([path.resolve(__dirname, 'src/browser/client')]);
  return wp? config(options, wp): options;
}