import node from "../src/node.js";
import tools from "./tools.js";
import database from "./db/database.js";
import loki from "./db/loki.js";
import behavior from "./behavior/behavior.js";
import behaviorFail from "./behavior/fail.js";
import approval from "./approval/approval.js"
import approvalCaptcha from "./approval/captcha.js"
import approvalClient from "./approval/client.js"
import cache from "./cache/cache.js";
import cacheDatabase from "./cache/database.js";
import logger from "./logger/logger.js";
import loggerConsole from "./logger/console.js";
import loggerFile from "./logger/file.js";
import loggerAdapter from "./logger/adapter.js";
import task from "./task/task.js";
import taskInterval from "./task/interval.js";
import taskCron from "./task/cron.js";
import server from "./server/server.js";
import express from "./server/express.js";

const Node = node();

export default function () {
  describe('services', () => {
    before(async function () {
      this.node = new Node(await tools.createNodeOptions({ server: false }));
      await this.node.init();
    });

    after(async function () {
      await this.node.destroy();
    });

    describe('db', () => {
      describe('database', database.bind(this));
      describe('loki', loki.bind(this));
    });

    describe('behavior', () => {
      describe('behavior', behavior.bind(this));
      describe('fail', behaviorFail.bind(this));
    });

    describe('approval', () => {
      describe('approval', approval.bind(this));
      describe('client', approvalClient.bind(this));
      describe('captcha', approvalCaptcha.bind(this));
    });

    describe('cache', () => {
      describe('cache', cache.bind(this));
      describe('Cache Database', cacheDatabase.bind(this));
    });

    describe('logger', () => {
      describe('logger', logger.bind(this));
      describe('console', loggerConsole.bind(this));
      describe('file', loggerFile.bind(this));
      describe('adapter', loggerAdapter.bind(this));
    });

    describe('task', () => {
      describe('task', task.bind(this));
      describe('interval', taskInterval.bind(this));
      describe('cron', taskCron.bind(this));
    });

    describe('server', () => {
      describe('server', server.bind(this));
      describe('express', express.bind(this));
    });
  });
}