import node from "../src/node.js";
import tools from "./tools.js";

import database from "./db/database.js";
import loki from "./db/loki.js";

import behavior from "./behavior/behavior.js";
import fail from "./behavior/fail.js";

import client from "./approval/client.js"
import approval from "./approval/approval.js"
import captcha from "./approval/captcha.js"

import cache from "./cache/cache.js";
import cacheDatabase from "./cache/database.js";

import logger from "./logger/logger.js";
import console from "./logger/console.js";
import file from "./logger/file.js";
import adapter from "./logger/adapter.js";

import task from "./task/task.js";
import interval from "./task/interval.js";
import cron from "./task/cron.js";

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
      describe('fail', fail.bind(this));
    });
    describe('approval', () => {
      describe('approval', approval.bind(this));
      describe('client', client.bind(this));
      describe('captcha', captcha.bind(this));
    });
    describe('cache', () => {
      describe('cache', cache.bind(this));
      describe('Cache Database', cacheDatabase.bind(this));
    });
    describe('logger', () => {
      describe('logger', logger.bind(this));
      describe('console', console.bind(this));
      describe('file', file.bind(this));
      describe('adapter', adapter.bind(this));
    });
    describe('task', () => {
      describe('task', task.bind(this));
      describe('interval', interval.bind(this));
      describe('cron', cron.bind(this));
    });
    describe('server', () => {
      describe('server', server.bind(this));
      describe('express', express.bind(this));
    });
  });
}