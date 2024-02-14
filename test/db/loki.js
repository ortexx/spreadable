import { assert } from "chai";
import fse from "fs-extra";
import path from "path";
import tools from "../tools.js";
import utils from "../../src/utils.js";
import loki from "../../src/db/transports/loki/index.js";
import behaviorFail from "../../src/behavior/transports/fail/index.js";
import approval from "../../src/approval/transports/approval/index.js";

const DatabaseLoki = loki();
const BehaviorFail = behaviorFail();
const Approval = approval();

export default function () {
  describe('DatabaseLoki', () => {
    let loki;
    let lastNodeDb;

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => loki = new DatabaseLoki({
          filename: tools.getDbFilePath(this.node)
        }));
        loki.node = this.node;
        lastNodeDb = this.node.db;
        this.node.db = loki;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await loki.init();
      });
      it('should create the db file', async function () {
        assert.isTrue(await fse.pathExists(tools.getDbFilePath(this.node)));
      });
    });

    describe('.setData()', function () {
      it('should set the value', async function () {
        await loki.setData('test', 'test');
        const obj = loki.col.data.findOne({ name: 'test' });
        assert.equal(obj.value, 'test');
      });
    });

    describe('.getData()', function () {
      it('should get the value', async function () {
        assert.equal(await loki.getData('test'), 'test');
      });
    });

    describe('.addSlave()', function () {
      it('should add the slave', async function () {
        const address = 'localhost:1';
        await loki.addSlave(address);
        assert.isObject(await loki.col.servers.findOne({ address, isSlave: true }));
      });

      it('should edit the slave', async function () {
        const address = 'localhost:1';
        await loki.addSlave(address);
        const servers = await loki.col.servers.find({ address, isSlave: true });
        assert.equal(servers.length, 1);
      });
    });

    describe('.hasSlave()', function () {
      it('should return true', async function () {
        assert.isTrue(await loki.hasSlave('localhost:1'));
      });

      it('should not return true', async function () {
        assert.isFalse(await loki.hasSlave('undefined'));
      });
    });

    describe('.getSlaves()', function () {
      it('should get one slave', async function () {
        const slaves = await loki.getSlaves();
        assert.equal(slaves.length, 1);
      });

      it('should get two slaves', async function () {
        await loki.addSlave('localhost:2');
        const slaves = await loki.getSlaves();
        assert.equal(slaves.length, 2);
      });
    });

    describe('.addBacklink()', function () {
      it('should add the backlink', async function () {
        const address = 'localhost:3';
        await loki.addBacklink(address);
        assert.isObject(await loki.col.servers.findOne({ address, isBacklink: true }));
      });

      it('should change the backlink and add it into the existent slave', async function () {
        const address = 'localhost:1';
        await loki.addBacklink(address);
        const servers = await loki.col.servers.find({ address, isBacklink: true });
        assert.equal(servers.length, 1, 'check servers count');
        assert.isTrue(servers[0].isSlave, 'check the backlink is a slave');
      });

      it('should edit the slave', async function () {
        const address = 'localhost:1';
        await loki.addBacklink(address);
        const servers = await loki.col.servers.find({ address });
        assert.equal(servers.length, 1);
      });
    });

    describe('.getBacklink()', function () {
      it('should get the backlink', async function () {
        const backlink = await loki.getBacklink();
        assert.isTrue(backlink.isBacklink);
      });
    });

    describe('.addMaster()', function () {
      it('should add the master', async function () {
        const address = 'localhost:3';
        await loki.addMaster(address, 0);
        assert.isObject(await loki.col.servers.findOne({ address, isMaster: true }));
      });

      it('should change the master and add it into the existent slave', async function () {
        const address = 'localhost:1';
        await loki.addMaster(address, 1);
        const servers = await loki.col.servers.find({ address, isMaster: true });
        assert.equal(servers.length, 1, 'check servers count');
        assert.isTrue(servers[0].isSlave, 'check the master is a slave');
      });

      it('should edit the master', async function () {
        const address = 'localhost:1';
        await loki.addMaster(address, 2);
        const servers = await loki.col.servers.find({ address, isMaster: true });
        const obj = servers[0];
        assert.equal(servers.length, 1, 'check the servers count');
        assert.equal(obj.size, 2, 'check the size');
      });
    });

    describe('.getMastersCount()', function () {
      it('should return two', async function () {
        assert.equal(await loki.getMastersCount(), 2);
      });

      it('should return three', async function () {
        await loki.addMaster('localhost:4', 0);
        assert.equal(await loki.getMastersCount(), 3);
      });
    });

    describe('.getSlavesCount()', function () {
      it('should return two', async function () {
        assert.equal(await loki.getSlavesCount(), 2);
      });

      it('should return three', async function () {
        await loki.addSlave('localhost:5', 0);
        assert.equal(await loki.getSlavesCount(), 3);
      });
    });

    describe('.getMasters()', function () {
      it('should return three masters', async function () {
        const masters = await loki.getMasters();
        assert.equal(masters.length, 3, 'check the masters count');
        
        for (let i = 0; i < masters.length; i++) {
          assert.isTrue(masters[i].isMaster, 'check the master status');
        }
      });
    });

    describe('.getMaster()', function () {
      it('should return the necessary master', async function () {
        const master = await loki.getMaster('localhost:4');
        assert.equal(master.address, 'localhost:4');
      });
      
      it('should not return the wrong master', async function () {
        assert.isNull(await loki.getMaster('localhost:2'));
      });
    });

    describe('.getServer()', function () {
      it('should return the necessary server', async function () {
        const server = await loki.getServer('localhost:4');
        assert.equal(server.address, 'localhost:4');
      });

      it('should not return the wrong server', async function () {
        assert.isNull(await loki.getServer('localhost:20'));
      });
    });

    describe('.getServers()', function () {
      it('should return all servers', async function () {
        const servers = await loki.getServers('localhost:4');
        assert.equal(servers.length, 5);
      });
    });

    describe('.removeSlave()', function () {
      it('should remove new slave', async function () {
        const count = await loki.getSlavesCount();
        await loki.addSlave('localhost:6');
        assert.equal(await loki.getSlavesCount(), count + 1, 'check before');
        await loki.removeSlave('localhost:6');
        assert.equal(await loki.getSlavesCount(), count, 'check after');
      });
    });

    describe('.removeSlaves()', function () {
      it('should remove all slaves', async function () {
        const count = await loki.getSlavesCount();
        assert.isOk(count > 0, 'check before');
        await loki.removeSlaves();
        assert.equal(await loki.getSlavesCount(), 0, 'check .getSlavesCount()');
        assert.equal((await loki.getSlaves()).length, 0, 'check .getSlaves()');
        assert.equal((await loki.getServers()).length, 3, 'check .getServers()');
      });
    });

    describe('.isMaster()', function () {
      it('should be false', async function () {
        assert.isFalse(await loki.isMaster());
      });

      it('should be true', async function () {
        await loki.addSlave('localhost:1');
        assert.isTrue(await loki.isMaster());
      });
    });

    describe('.shiftSlaves()', function () {
      it('should shift 2 slaves', async function () {
        await loki.addSlave('localhost:2');
        await loki.addSlave('localhost:3');
        const count = await loki.getSlavesCount();
        const limit = 2;
        await loki.shiftSlaves(limit);
        assert.equal(await loki.getSlavesCount(), await count - limit, 'check the count');
        assert.equal((await loki.getSlaves())[0].address, 'localhost:1', 'check the sort');
      });
    });

    describe('.removeBacklink()', function () {
      it('should remove the backlink', async function () {
        const count = (await loki.getServers()).length;
        assert.isNotNull(await loki.getBacklink(), 'check before');
        await loki.removeBacklink();
        assert.isNull(await loki.getBacklink(), 'check the backlink after');
        assert.equal((await loki.getServers()).length, count, 'check .getServers()');
      });
    });

    describe('.removeMaster()', function () {
      it('should remove the master', async function () {
        const address = 'localhost:1';
        await loki.removeMaster(address);
        assert.isNull(await loki.getMaster(address));
      });
    });

    describe('.removeMasters()', function () {
      it('should remove all masters', async function () {
        await loki.addMaster('localhost:1', 0);
        await loki.removeMasters();
        assert.equal(await loki.getMastersCount(), 0, 'check .getMastersCount()');
        assert.equal((await loki.getMasters()).length, 0, 'check .getMasters()');
        assert.equal((await loki.getServers()).length, 1, 'check .getServers()');
      });
    });

    describe('.failedServerAddress()', function () {
      let address;
      let isBroken;

      before(function () {
        address = 'localhost:1';
      });

      it('should increase the fails count', async function () {
        const server = await loki.getServer(address);
        isBroken = server.isBroken;
        assert.equal(server.fails, 0, 'check before');
        
        for (let i = 0; i < this.node.options.network.serverMaxFails + 1; i++) {
          await loki.failedServerAddress(address);
          assert.equal(server.fails, i + 1, 'check after');
        }
      });

      it('should change the server status to "isBroken"', async function () {
        assert.isFalse(isBroken, 'check before');
        const server = await loki.getServer(address);
        assert.isTrue(server.isBroken, 'check after');
      });
    });

    describe('.successServerAddress()', function () {
      let address;
      let isBroken;

      before(function () {
        address = 'localhost:1';
      });

      it('should decrease the fails count', async function () {
        const server = await loki.getServer(address);
        isBroken = server.isBroken;
        assert.isOk(server.fails > 0, 'check before');
        await loki.successServerAddress(address);
        assert.equal((await loki.getServer(address)).fails, 0, 'check after');
      });

      it('should remove "isBroken" status', async function () {
        assert.isTrue(isBroken, 'check before');
        const server = await loki.getServer(address);
        assert.isFalse(server.isBroken, 'check after');
      });
    });

    describe('.normalizeServers()', function () {
      let address;

      before(function () {
        address = 'localhost:1';
      });

      it('should set "isBroken" to false', async function () {
        const server = await loki.getServer(address);
        server.isBroken = true;
        assert.isOk(server.fails <= this.node.options.network.serverMaxFails, 'check fails');
        await loki.normalizeServers();
        assert.isFalse((await loki.getServer(address)).isBroken, 'check the status');
      });

      it('should set "isBroken" to true', async function () {
        for (let i = 0; i < this.node.options.network.serverMaxFails + 1; i++) {
          await loki.failedServerAddress(address);
        }

        await loki.normalizeServers();
        assert.isTrue((await loki.getServer(address)).isBroken);
      });
      
      it('should remove the slave with the current node address', async function () {
        await loki.addSlave(this.node.address, 0);
        assert.isObject(await loki.getServer(this.node.address), 'check before');
        await loki.normalizeServers();
        assert.isNull(await loki.getServer(this.node.address), 'check after');
      });

      it('should remove the backlink with the current node address', async function () {
        await loki.addBacklink(this.node.address);
        assert.isObject(await loki.getServer(this.node.address), 'check before');
        await loki.normalizeServers();
        assert.isNull(await loki.getServer(this.node.address), 'check after');
      });

      it('should remove the server with wrong statuses', async function () {
        const address = 'localhost:1';
        const server = await loki.getServer(address);
        assert.isObject(server, 'check before');
        server.isMaster = false;
        server.isSlave = false;
        server.isBacklink = false;
        loki.col.servers.update(server);
        await loki.normalizeServers();
        assert.isNull(await loki.getServer(address), 'check after');
      });

    });

    describe('.addBanlistAddress()', function () {
      it('should add the address', async function () {
        const address = 'localhost:1';
        await loki.addBanlistAddress(address, '1d');
        assert.isOk(loki.col.banlist.count({ address }));
      });

      it('should not create the same address', async function () {
        const address = 'localhost:1';
        await loki.addBanlistAddress(address, '1d');
        assert.equal(loki.col.banlist.count({ address }), 1);
      });
    });

    describe('.getBanlist()', function () {
      it('should return the list', async function () {
        const address = 'localhost:1';
        const list = await loki.getBanlist();
        assert.lengthOf(list, 1, 'check the count');
        assert.equal(list[0].address, address, 'check the address');
      });
    });

    describe('.getBanlistAddress()', function () {
      it('should return the address', async function () {
        const address = 'localhost:1';
        const server = await loki.getBanlistAddress(address);
        assert.equal(server.address, address);
      });

      it('should not return the wrong address', async function () {
        assert.isNull(await loki.getBanlistAddress('wrong'));
      });
    });

    describe('.checkBanlistIp()', function () {
      it('should return true', async function () {
        const address = 'localhost:1';
        const server = await loki.getBanlistAddress(address);
        assert.isOk(await loki.checkBanlistIp(server.ip));
      });

      it('should return false', async function () {
        assert.isFalse(await loki.checkBanlistIp('wrong'));
      });
    });

    describe('.removeBanlistAddress()', function () {
      it('should remove the address', async function () {
        const address = 'localhost:1';
        await loki.removeBanlistAddress(address);
        assert.isNull(await loki.getBanlistAddress(address));
      });
    });

    describe('.normalizeBanlist()', function () {
      it('check the lifetime', async function () {
        const address = 'localhost:1';
        await loki.addBanlistAddress(address, 1000 * 60);
        const count = loki.col.banlist.count();
        await loki.normalizeBanlist();
        const data = loki.col.banlist.find();
        assert.equal(count, data.length, 'check before');
        data[0].resolvedAt = Date.now() - 1;
        await loki.normalizeBanlist();
        assert.equal(count - 1, loki.col.banlist.count(), 'check after');
      });
    });

    describe('.emptyBanlist()', function () {
      it('should empty the list', async function () {
        for (let i = 1; i < 10; i++) {
          await loki.addBanlistAddress(`localhost:${i}`, '1d');
        }

        await loki.emptyBanlist();
        assert.lengthOf(await loki.getBanlist(), 0);
      });
    });

    describe('candidates behavior', function () {
      let action;

      before(function () {
        action = 'test';
      });

      describe('.addBehaviorCandidate()', function () {
        it('should add the behavior', async function () {
          loki.col.servers.chain().find().remove();
          const address = 'localhost:1';
          await loki.addMaster(address, 3);
          await loki.addBehaviorCandidate(action, address);
          const behavior = loki.col.behaviorCandidates.findOne({ address, action });
          assert.equal(behavior.suspicion, 1, 'check the suspicion');
          assert.equal(behavior.excuse, 0, 'check the excuse');
          const wrongBehavior = loki.col.behaviorCandidates.findOne({ address, action: 'wrong' });
          assert.isNull(wrongBehavior, 'check the wrong action');
        });

        it('should add the second candidate behavior', async function () {
          const address = 'localhost:2';
          await loki.addBehaviorCandidate(action, address);
          const behavior = loki.col.behaviorCandidates.findOne({ address, action });
          assert.equal(behavior.suspicion, 1, 'check the suspicion');
          assert.equal(behavior.excuse, 0, 'check the excuse');
        });

        it('should change the first candidate excuse', async function () {
          const address = 'localhost:1';
          const behavior = loki.col.behaviorCandidates.findOne({ address, action });
          assert.equal(behavior.excuse, await this.node.getCandidateExcuseStep());
        });

        it('should add suspicion to the second candidate', async function () {
          const address = 'localhost:2';
          let behavior = loki.col.behaviorCandidates.findOne({ address, action });
          const lastSuspicion = behavior.suspicion;
          const count = 3;
          for (let i = 0; i < count; i++) {
            await loki.addBehaviorCandidate(action, address);
          }
          behavior = loki.col.behaviorCandidates.findOne({ address, action });
          assert.equal(behavior.suspicion, lastSuspicion + count, 'check the suspicion');
          assert.equal(behavior.excuse, 0, 'check the excuse');
        });

        it('should add the third candidate behavior', async function () {
          const address = 'localhost:3';
          await loki.addBehaviorCandidate(action, address);
          const behavior = loki.col.behaviorCandidates.findOne({ address, action });
          assert.equal(behavior.suspicion, 1, 'check the suspicion');
          assert.equal(behavior.excuse, 0, 'check the excuse');
        });

        it('should remove the first candidate behavior', async function () {
          const address = 'localhost:1';
          assert.isNull(loki.col.behaviorCandidates.findOne({ address, action }));
        });

        it('should change the second candidate excuse', async function () {
          const address = 'localhost:2';
          const behavior = loki.col.behaviorCandidates.findOne({ address, action });
          assert.equal(behavior.excuse, await this.node.getCandidateExcuseStep());
        });
      });

      describe('.normalizeBehaviorCandidates()', function () {
        it('should decrease the candidate suspicion', async function () {
          const address = 'localhost:2';
          let behavior = loki.col.behaviorCandidates.findOne({ address, action });
          const level = await this.node.getCandidateSuspicionLevel();
          assert.isOk(behavior.suspicion > level, 'check before');
          await loki.normalizeBehaviorCandidates();
          behavior = loki.col.behaviorCandidates.findOne({ address, action });
          assert.isOk(behavior.suspicion <= level, 'check after');
        });

        it('should remove the candidate', async function () {
          const address = 'localhost:2';
          const behavior = loki.col.behaviorCandidates.findOne({ address, action });
          behavior.excuse = behavior.suspicion + 1;
          loki.col.behaviorCandidates.update(behavior);
          await loki.normalizeBehaviorCandidates();
          assert.isNull(loki.col.behaviorCandidates.findOne({ address, action }));
        });
      });

      describe('.getBehaviorCandidates()', function () {
        it('should not get any candidates', async function () {
          const address = 'localhost:3';
          const level = await this.node.getCandidateSuspicionLevel();
          const behavior = loki.col.behaviorCandidates.findOne({ address, action });
          assert.isOk(behavior.suspicion < level, 'check before');
          const candidates = await loki.getBehaviorCandidates(action);
          assert.equal(candidates.length, 0, 'check after');
        });

        it('should get an array with the third candidate', async function () {
          const address = 'localhost:3';
          const level = await this.node.getCandidateSuspicionLevel();
          const behavior = loki.col.behaviorCandidates.findOne({ address, action });
          behavior.suspicion = level;
          loki.col.behaviorCandidates.update(behavior);
          const candidates = await loki.getBehaviorCandidates(action);
          assert.equal(candidates.length, 1, 'check the length');
          assert.equal(candidates[0].address, address, 'check the address');
          const wrongCandidates = await loki.getBehaviorCandidates('wrong');
          assert.equal(wrongCandidates.length, 0, 'check the wrong action');
        });
      });
    });

    describe('delays behavior', function () {
      let action;

      before(function () {
        action = 'test';
      });

      describe('.addBehaviorDelay()', function () {
        it('should add the behavior', async function () {
          const address = 'localhost:1';
          await loki.addBehaviorDelay(action, address);
          const behavior = loki.col.behaviorDelays.findOne({ action, address });
          assert.equal(behavior.address, address);
        });

        it('should not create the same behavior', async function () {
          const address = 'localhost:1';
          await loki.addBehaviorDelay(action, address);
          const data = loki.col.behaviorDelays.find({ action, address });
          assert.equal(data.length, 1);
        });
      });

      describe('.getBehaviorDelay()', function () {
        it('should get the behavior', async function () {
          const address = 'localhost:1';
          const behavior = await loki.getBehaviorDelay(action, address);
          assert.equal(behavior.address, address, 'check the behavior');
          const wrongBehavior = loki.col.behaviorDelays.findOne({ address, action: 'wrong' });
          assert.isNull(wrongBehavior, 'check the wrong action');
        });

        it('should not get the wrong behavior', async function () {
          assert.isNull(await loki.getBehaviorDelay(action, 'wrong'));
        });
      });

      describe('.removeBehaviorDelay()', function () {
        it('should remove behavior', async function () {
          const address = 'localhost:1';
          await loki.addBehaviorDelay(action, 'localhost:2');
          await loki.removeBehaviorDelay(action, address);
          let behavior = loki.col.behaviorDelays.findOne({ address, action });
          assert.isNull(behavior, 'check the removed behavior');
          behavior = loki.col.behaviorDelays.findOne({ action });
          assert.isNotNull(behavior, 'check the others');
        });
      });

      describe('.cleanBehaviorDelays()', function () {
        it('should remove all action behavior', async function () {
          const address = 'localhost:1';
          await loki.addBehaviorDelay(action, address);
          await loki.addBehaviorDelay('anotherAction', address);
          let data = loki.col.behaviorDelays.find({ action });
          assert.equal(data.length, 2, 'check before');
          await loki.cleanBehaviorDelays(action);
          data = loki.col.behaviorDelays.find({ action });
          assert.equal(data.length, 0, 'check the current action');
          data = loki.col.behaviorDelays.find();
          assert.equal(data.length, 1, 'check new action');
        });
      });
    });

    describe('approval', function () {
      let action;
      let key;

      before(function () {
        action = 'test';
        key = 'key';
      });

      describe('.addApproval()', function () {
        it('should add the approval', async function () {
          await this.node.addApproval(action, new Approval());
          const ip = '127.0.0.1';
          const clientIp = utils.isIpv6(ip) ? utils.getFullIpv6(ip) : utils.ipv4Tov6(ip);
          const startedAt = Date.now();
          const info = 1;
          await loki.addApproval(action, ip, key, startedAt, info);
          const approval = loki.col.approval.findOne({ action, clientIp, key, startedAt, info });
          assert.containsAllKeys(approval, ['usedBy', 'updatedAt']);
        });

        it('should replace the approval', async function () {
          const ip = '127.0.0.1';
          const clientIp = utils.isIpv6(ip) ? utils.getFullIpv6(ip) : utils.ipv4Tov6(ip);
          key = 'newKey';
          const startedAt = Date.now();
          const info = 2;
          await loki.addApproval(action, ip, key, startedAt, info);
          const approval = loki.col.approval.findOne({ action, clientIp, key, startedAt, info });
          assert.isNotNull(approval, 'check the new one');
          assert.lengthOf(loki.col.approval.find(), 1, 'check the count');
        });
      });

      describe('.getApproval()', function () {
        it('should get the approval', async function () {
          const approval = await loki.getApproval(key);
          assert.isNotNull(approval);
        });

        it('should not get the wrong approval', async function () {
          assert.isNull(await loki.getApproval('wrong key'));
        });
      });

      describe('.startApproval()', function () {
        it('should start the approval', async function () {
          const answer = 1;
          await loki.startApproval(key, answer);
          const approval = await loki.getApproval(key);
          assert.equal(approval.answer, answer);
        });
      });

      describe('.useApproval()', function () {
        it('should use the approval', async function () {
          const address = 'localhost:1';
          let approval = await loki.getApproval(key);
          const date = approval.updatedAt;
          await tools.wait(10);
          await loki.useApproval(key, address);
          approval = await loki.getApproval(key);
          assert.equal(approval.usedBy[0], address, 'check the user');
          assert.isOk(approval.updatedAt > date, 'check the date');
        });

        it('should add the new user', async function () {
          const address = 'localhost:2';
          await loki.useApproval(key, address);
          const approval = await loki.getApproval(key);
          assert.equal(approval.usedBy[1], address);
        });

        it('should not add the same user', async function () {
          const address = 'localhost:2';
          await loki.useApproval(key, address);
          const approval = await loki.getApproval(key);
          assert.lengthOf(approval.usedBy, 2);
        });
      });

      describe('.normalizeApproval()', function () {
        it('check the lifetime', async function () {
          const count = loki.col.approval.count({ action });
          await loki.normalizeApproval();
          const data = loki.col.approval.find({ action });
          assert.equal(count, data.length, 'check before');
          const approval = await this.node.getApproval(action);
          data[0].updatedAt = Date.now() - approval.period - 1;
          await loki.normalizeApproval();
          assert.equal(count - 1, loki.col.approval.count({ action }), 'check after');
        });
      });
    });

    describe('fails behavior', function () {
      let action;

      before(function () {
        action = 'test';
      });
      
      describe('.addBehaviorFail()', function () {
        it('should throw an error', async function () {
          const address = 'localhost:1';

          try {
            await loki.addBehaviorFail(action, address);
            throw new Error('Fail');
          }
          catch (err) {
            assert.isOk(err.message.includes("doesn't exist"));
          }
        });

        it('should add the behavior', async function () {
          await this.node.addBehavior(action, new BehaviorFail());
          const address = 'localhost:1';
          await loki.addBehaviorFail(action, address);
          const behavior = loki.col.behaviorFails.findOne({ action, address });
          assert.isNotNull(behavior);
        });

        it('should have the expected suspicion and balance', async function () {
          const address = 'localhost:2';
          const count = 5;

          for (let i = 0, b = 1; i < count; i += 2, b++) {
            await loki.addBehaviorFail(action, address, 2);
            const behavior = loki.col.behaviorFails.findOne({ action, address });
            assert.equal(behavior.suspicion, i + 2, 'check the suspicion');
            assert.equal(behavior.balance, b, 'check the balance');
          }
        });

        it('should handle the step as a function', async function () {
          const address = 'localhost:1';
          let behavior = loki.col.behaviorFails.findOne({ action, address });
          const suspicion = behavior.suspicion;
          const balance = behavior.balance;
          await loki.addBehaviorFail(action, address, b => b.balance * 2);
          behavior = loki.col.behaviorFails.findOne({ action, address });
          assert.equal(behavior.suspicion, suspicion + balance * 2, 'check the suspicion');
          assert.equal(behavior.balance, balance + 1, 'check the balance');
        });

        it('should handle up and down fields', async function () {
          const address = 'localhost:3';
          for (let i = 0; i < 3; i++) {
            const behavior = await loki.addBehaviorFail(action, address);
            assert.equal(behavior.up, i + 1, 'check addition');
            assert.equal(behavior.down, 0, 'check reset for down');
          }

          for (let i = 0; i < 3; i++) {
            const behavior = await loki.subBehaviorFail(action, address);
            assert.equal(behavior.down, i + 1, 'check subtraction');
            assert.equal(behavior.up, 0, 'check reset for up');
          }
        });
      });

      describe('.getBehaviorFail()', function () {
        it('should get the behavior', async function () {
          const address = 'localhost:1';
          const behavior = await loki.getBehaviorFail(action, address);
          assert.equal(behavior.address, address, 'check the behavior');
          const wrongBehavior = loki.col.behaviorFails.findOne({ address, action: 'wrong' });
          assert.isNull(wrongBehavior, 'check the wrong action');
        });

        it('should not get the wrong behavior', async function () {
          assert.isNull(await loki.getBehaviorFail(action, 'wrong'));
        });
      });

      describe('.subBehaviorFail()', function () {
        it('should subtract the behavior', async function () {
          const address = 'localhost:1';
          let behavior = await loki.getBehaviorFail(action, address);
          behavior.suspicion = 4;
          loki.col.behaviorFails.update(behavior);
          await loki.subBehaviorFail(action, address);
          behavior = await loki.getBehaviorFail(action, address);
          assert.equal(behavior.suspicion, 3);
        });

        it('should handle the step as a function', async function () {
          const address = 'localhost:1';
          await loki.subBehaviorFail(action, address, () => 1);
          const behavior = await loki.getBehaviorFail(action, address);
          assert.equal(behavior.suspicion, 2);
        });

        it('should subtract the behavior with the custom step and remove', async function () {
          const address = 'localhost:1';
          await loki.subBehaviorFail(action, address, 2);
          assert.isNull(await loki.getBehaviorFail(action, address));
        });
      });

      describe('.cleanBehaviorFail()', function () {
        it('should remove the behavior', async function () {
          const address = 'localhost:1';
          await loki.addBehaviorFail(action, address, 10);
          await loki.cleanBehaviorFail(action, address);
          assert.isNull(await loki.getBehaviorFail(action, address));
        });
      });

      describe('.normalizeBehaviorFails()', function () {
        it('check the lifetime', async function () {
          const count = loki.col.behaviorFails.count({ action });
          await loki.normalizeBehaviorFails();
          const data = loki.col.behaviorFails.find({ action });
          assert.equal(count, data.length, 'check before');
          data[0].updatedAt = 0;
          loki.col.behaviorFails.update(data[0]);
          await loki.normalizeBehaviorFails();
          assert.equal(count - 1, loki.col.behaviorFails.count({ action }), 'check after');
        });

        it('check the banlist delay', async function () {
          loki.col.banlist.chain().find().remove();
          const address = 'localhost:1';
          const behavior = await loki.addBehaviorFail(action, address);
          await loki.normalizeBehaviorFails();
          assert.equal(loki.col.banlist.count(), 0, 'check the banlist before');
          const options = await loki.node.getBehavior(action);
          options.banDelay = 1000;
          behavior.suspicion = options.failSuspicionLevel + 1;
          loki.col.behaviorFails.update(behavior);
          await tools.wait(10);
          await loki.normalizeBehaviorFails();
          assert.equal(loki.col.banlist.count(), 0, 'check the banlist after');
          assert.isNotNull(await loki.getBehaviorFail(action, address), 'check the fail');
        });

        it('check the banlist', async function () {
          loki.col.banlist.chain().find().remove();
          const address = 'localhost:1';
          const behavior = await loki.addBehaviorFail(action, address);
          behavior.createdAt = 0;
          loki.col.behaviorFails.update(behavior);
          await loki.normalizeBehaviorFails();
          assert.equal(loki.col.banlist.count(), 1, 'check the banlist');
          assert.isNull(await loki.getBehaviorFail(action, address), 'check the fail');
        });
      });
    });
    
    describe('cache', function () {
      let type;

      before(function () {
        type = 'test';
      });

      describe('.setCache()', function () {
        it('should set the cache', async function () {
          const key = 'key1';
          await loki.setCache(type, key, 1);
          assert.isOk(loki.col.cache.count({ type, key }));
        });

        it('should update the same cache', async function () {
          const key = 'key1';
          await loki.setCache(type, key, 2);
          const data = loki.col.cache.find({ type, key });
          assert.equal(data.length, 1, 'check the length');
          assert.equal(data[0].value, 2, 'check the value');
        });

        it('should keep the limit', async function () {
          const limit = 5;
          const key = 'key1';
          for (let i = 1; i < limit + 1; i++) {
            await tools.wait(10);
            await loki.setCache(type, i, i, { limit });
          }
          const data = loki.col.cache.find({ type });
          assert.equal(data.length, limit, 'check the length');
          assert.notEqual(data[0].key, key, 'check the first');
        });
      });

      describe('.getCache()', function () {
        let accessTime;

        it('should get the cache', async function () {
          await loki.setCache(type, 'key1', 1);
          const cache = await loki.getCache(type, 'key1');
          accessTime = cache.accessedAt;
          assert.isObject(cache);
        });

        it('should update the access time', async function () {
          await tools.wait(1);
          const cache = await loki.getCache(type, 'key1');
          assert.isOk(cache.accessedAt > accessTime);
        });

        it('should not get the wrong type cache', async function () {
          assert.isNull(await loki.getCache('wrong', 'key1'));
        });

        it('should not get the wrong key cache', async function () {
          assert.isNull(await loki.getCache(type, 'wrong'));
        });
      });

      describe('.removeCache()', function () {
        it('should not remove the wrong type cache', async function () {
          const key = 'key1';
          await loki.removeCache('wrong', key);
          assert.isOk(loki.col.cache.count({ type, key }));
        });

        it('should not remove the wrong key cache', async function () {
          const key = 'key1';
          await loki.removeCache(type, 'wrong');
          assert.isOk(loki.col.cache.count({ type, key }));
        });

        it('should remove the cache', async function () {
          const key = 'key1';
          await loki.removeCache(type, key);
          assert.isNotOk(loki.col.cache.count({ type, key }));
        });
      });

      describe('.normalizeCache()', function () {
        it('should keep the right limit', async function () {
          const limit = 5;
          const key = 'key1';
          
          for (let i = 1; i < limit + 1; i++) {
            await loki.setCache(type, i, i);
            await tools.wait(10);
          }

          await loki.normalizeCache(type, { limit });
          const data = loki.col.cache.find({ type });
          assert.equal(data.length, limit, 'check the length');
          assert.notEqual(data[0].key, key, 'check the first');
        });

        it('should remove old cache', async function () {
          const count = loki.col.cache.chain().find({ type }).count();
          await tools.wait(10);
          await loki.setCache(type, count + 1, count + 1);
          await loki.normalizeCache(type, { lifetime: 9 });
          assert.equal(1, loki.col.cache.chain().find({ type }).count());
        });
      });

      describe('.flushCache()', function () {
        it('should remove all cache', async function () {
          for (let i = 1; i < 5; i++) {
            await loki.setCache(type, i);
          }
          await loki.flushCache(type);
          assert.equal(loki.col.cache.count({ type }), 0);
        });
      });
    });
    describe('.backup()', function () {
      it('should create a backup', async function () {
        await loki.backup();
        const files = await fse.readdir(loki.options.backups.folder);
        const backupBuffer = await fse.readFile(path.join(loki.options.backups.folder, files[0]));
        const dbBuffer = await fse.readFile(loki.options.filename);
        assert.isTrue(backupBuffer.equals(dbBuffer));
      });

      it('should create the secong backup', async function () {
        await loki.backup();
        const files = await fse.readdir(loki.options.backups.folder);
        const backupBuffer = await fse.readFile(path.join(loki.options.backups.folder, files[1]));
        const dbBuffer = await fse.readFile(loki.options.filename);
        assert.isTrue(backupBuffer.equals(dbBuffer));
      });
    });

    describe('.restore()', function () {
      it('should restore from the last backup', async function () {
        await loki.setData('restore', 1);
        await loki.restore();
        const files = await fse.readdir(loki.options.backups.folder);
        const backupBuffer = await fse.readFile(path.join(loki.options.backups.folder, files[1]));
        const dbBuffer = await fse.readFile(loki.options.filename);
        assert.isTrue(backupBuffer.equals(dbBuffer));
      });

      it('should restore from the first backup', async function () {
        await loki.setData('restore', 2);
        await loki.restore(1);
        const files = await fse.readdir(loki.options.backups.folder);
        const backupBuffer = await fse.readFile(path.join(loki.options.backups.folder, files[0]));
        const dbBuffer = await fse.readFile(loki.options.filename);
        assert.isTrue(backupBuffer.equals(dbBuffer));
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await loki.deinit();
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        await loki.init();
      });
    });

    describe('.destroy()', function () {
      it('should not throw an exception', async function () {
        await loki.destroy();
        this.node.db = lastNodeDb;
      });
      
      it('should remove the db file', async function () {
        assert.isFalse(await fse.pathExists(tools.getDbFilePath(this.node)));
      });
    });
  });
}