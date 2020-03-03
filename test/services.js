const Node = require('../src/node')();
const tools = require('./tools');

describe('services', () => {
  before(async function () {
    this.node = new Node(await tools.createNodeOptions({ server: false }));
    await this.node.init();
  });  

  after(async function () {
    await this.node.destroy();
  });  
  
  describe('db', () => {
    require('./db/database');
    require('./db/loki');    
  });

  describe('behavior', () => {
    require('./behavior/behavior');
    require('./behavior/fail'); 
  });

  describe('approval', () => {
    require('./approval/approval');
    require('./approval/client'); 
    require('./approval/captcha'); 
  });

  describe('cache', () => {
    require('./cache/cache');
    require('./cache/database');
  });

  describe('logger', () => {
    require('./logger/logger');
    require('./logger/console');
    require('./logger/file');
    require('./logger/adapter');
  });

  describe('task', () => {
    require('./task/task');
    require('./task/interval');
    require('./task/cron');
  });

  describe('server', () => {
    require('./server/server');
    require('./server/express');    
  });
});