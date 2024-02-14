import database from "../database/index.js";
import fse from "fs-extra";
import path from "path";
import merge from "lodash-es/merge.js";
import loki from "lokijs";
import LokiFsSyncAdapter from "lokijs";
import utils from "../../../utils.js";
import { onExit } from "signal-exit";

const Database = database();

export default (Parent) => {
  /**
   * Lokijs database transport
   */
  return class DatabaseLoki extends (Parent || Database) {
    constructor(options = {}) {
      options = merge({
        autosaveInterval: 10000
      }, options);
      super(options);
      this.col = {};
    }

    /**
     * @see Database.prototype.init
     */
    async init() {
      await super.init.apply(this, arguments);
      !this.options.filename && (this.options.filename = path.join(this.node.storagePath, 'loki.db'));
      await fse.ensureFile(this.options.filename);
      await this.createBackupQueue();
      await this.createDatabase();
      this.createExitListener();
    }

    /**
     * @see Database.prototype.deinit
     */
    async deinit() {
      this.removeExitListener();
      await this.saveDatabase();
      this.loki && this.loki.close();
      delete this.loki;
      await super.deinit.apply(this, arguments);
    }

    /**
     * @see Database.prototype.destroy
     */
    async destroy() {
      this.removeExitListener();
      this.loki.autosaveDisable();
      await this.deleteDatabase();
      delete this.loki;
      await super.destroy.apply(this, arguments);
    }

    /**
     * @see Database.prototype.backup
     */
    async backup() {
      const filePath = path.join(this.__backupQueue.folderPath, this.__backupQueue.createNewName());
      await fse.copy(this.options.filename, filePath);
      await this.__backupQueue.normalize();
    }

    /**
     * @see Database.prototype.restore
     */
    async restore(index) {
      const file = !index ? this.__backupQueue.getLast() : this.__backupQueue.files[index - 1];

      if (!file) {
        throw new Error('Not found anything to restore the database');
      }

      await fse.copy(file.filePath, this.options.filename);
    }

    /**
     * Create the db instance
     *
     * @async
     */
    async createDatabase() {
      return await new Promise((resolve, reject) => {
        this.loki = new loki(this.options.filename, merge(this.options, {
          autoload: true,
          autosave: true,
          autoloadCallback: (err) => {
            if (err) {
              return reject(err);
            }

            this.initCollections();
            resolve(this.loki);
          }
        }));
      });
    }

    /**
     * Create the backup queue
     *
     * @async
     */
    async createBackupQueue() {
      this.__backupQueue = new utils.FilesQueue(this.options.backups.folder, {
        limit: this.options.backups.limit,
        ext: 'db'
      });
      await this.__backupQueue.normalize();
    }

    /**
     * Create the exit listener
     *
     * @async
     */
    createExitListener() {
      this.__onExitListenerRemoveFn = onExit(() => {
        if (this.loki && this.__initialized) {
          this.loki.persistenceMethod = 'adapter';
          this.loki.persistenceAdapter = new LokiFsSyncAdapter();
          this.saveDatabase();
        }
      });
    }

    /**
     * Remove the exit listener
     *
     * @async
     */
    removeExitListener() {
      this.__onExitListenerRemoveFn && this.__onExitListenerRemoveFn();
    }

    /**
     * Save the database
     *
     * @async
     */
    async saveDatabase() {
      if (!this.loki) {
        return;
      }

      return new Promise((resolve, reject) => {
        this.loki.saveDatabase((err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    }

    /**
     * Delete the database
     *
     * @async
     */
    async deleteDatabase() {
      if (!this.loki || !(await fse.pathExists(this.loki.filename))) {
        return;
      }

      return new Promise((resolve, reject) => {
        this.loki.deleteDatabase((err) => {
          if (err) {
            return reject(err);
          }

          resolve();
        });
      });
    }

    /**
     * Prepare the collection
     *
     * @param {string} name
     * @param {object} [options]
     * @returns {object}
     */
    prepareCollection(name, options = {}) {
      options = Object.assign({
        disableMeta: true
      }, options);
      let collection = this.loki.getCollection(name);

      if (!collection) {
        return this.loki.addCollection(name, options);
      }

      if (options.unique) {
        !Array.isArray(options.unique) && (options.unique = [options.unique]);
        for (const field of options.unique) {
          collection.ensureUniqueIndex(field);
        }
      }

      if (options.indices) {
        !Array.isArray(options.indices) && (options.indices = [options.indices]);
        for (const field of options.indices) {
          collection.ensureIndex(field);
        }
      }

      for (let key in collection.binaryIndices) {
        if (!options.indices.includes(key)) {
          delete collection.binaryIndices[key];
        }
      }

      for (let key in collection.constraints.unique) {
        if (!options.unique.includes(key)) {
          delete collection.constraints.unique[key];
          collection.uniqueNames = collection.uniqueNames.filter(v => v != key);
        }
      }

      return collection;
    }

    /**
     * Initialize all collections
     */
    initCollections() {
      this.initCollectionCache();
      this.initCollectionData();
      this.initCollectionServers();
      this.initCollectionBanlist();
      this.initCollectionApproval();
      this.initCollectionBehaviorCandidates();
      this.initCollectionBehaviorDelays();
      this.initCollectionBehaviorFails();
    }

    /**
     * Initialize the cache collection
     */
    initCollectionCache() {
      this.col.cache = this.prepareCollection('cache', { indices: ['type'] });
    }

    /**
     * Initialize the data collection
     */
    initCollectionData() {
      this.col.data = this.prepareCollection('data', { unique: ['name'] });
      const rootNetworkAddress = this.col.data.findOne({ name: 'rootNetworkAddress' });
      const registrationTime = this.col.data.findOne({ name: 'registrationTime' });

      if (!rootNetworkAddress) {
        this.col.data.insert({ name: 'rootNetworkAddress', value: '' });
      }

      if (!registrationTime) {
        this.col.data.insert({ name: 'registrationTime', value: null });
      }
    }

    /**
     * Initialize the servers collection
     */
    initCollectionServers() {
      this.col.servers = this.prepareCollection('servers', { unique: ['address'] });
    }

    /**
     * Initialize the banlist collection
     */
    initCollectionBanlist() {
      this.col.banlist = this.prepareCollection('banlist', { unique: ['address'] });
    }

    /**
     * Initialize the approval collection
     */
    initCollectionApproval() {
      const options = { indices: ['clientIp', 'action'] };
      this.col.approval = this.prepareCollection('approval', options);
    }

    /**
     * Initialize the candidates behavior collection
     */
    initCollectionBehaviorCandidates() {
      const options = { indices: ['address', 'action'] };
      this.col.behaviorCandidates = this.prepareCollection('behaviorCandidates', options);
    }

    /**
     * Initialize the delays behavior collection
     */
    initCollectionBehaviorDelays() {
      const options = { indices: ['address', 'action'] };
      this.col.behaviorDelays = this.prepareCollection('behaviorDelays', options);
    }

    /**
     * Initialize the fails behavior collection
     */
    initCollectionBehaviorFails() {
      const options = { indices: ['address', 'action'] };
      this.col.behaviorFails = this.prepareCollection('behaviorFails', options);
    }

    /**
     * Create the server collection fields
     *
     * @param {object} [obj]
     * @returns {object}
     */
    createServerFields(obj = {}) {
      const now = Date.now();
      const fields = merge({
        size: 0,
        createdAt: now,
        updatedAt: now,
        fails: 0,
        level: 0,
        isSlave: false,
        isBacklink: false,
        isMaster: false,
        isBroken: false,
      }, obj);

      if (!fields.createdAt) {
        fields.createdAt = now;
      }

      return fields;
    }

    /**
     * Create the banlist collection fields
     *
     * @param {object} [obj]
     * @returns {object}
     */
    createBanlistFields(obj = {}) {
      const now = Date.now();
      return merge({
        createdAt: now,
        updatedAt: now,
        reason: ''
      }, obj);
    }

    /**
     * Create the candidates behavior collection fields
     *
     * @param {object} [obj]
     * @returns {object}
     */
    createBehaviorCandidateFields(obj = {}) {
      const now = Date.now();
      return merge({
        createdAt: now,
        updatedAt: now,
        suspicion: 1,
        excuse: 0
      }, obj);
    }

    /**
     * Create the delays behavior fields
     *
     * @param {object} [obj]
     * @returns {object}
     */
    createBehaviorDelaysFields(obj = {}) {
      const now = Date.now();
      return merge({
        createdAt: now,
        updatedAt: now
      }, obj);
    }

    /**
     * Create the failed behavior collection fields
     *
     * @param {object} [obj]
     * @returns {object}
     */
    createBehaviorFailsFields(obj = {}) {
      const now = Date.now();
      return merge({
        createdAt: now,
        updatedAt: now,
        suspicion: 1,
        balance: 0,
        up: 0,
        down: 0
      }, obj);
    }

    /**
     * @see Database.prototype.setData
     */
    async setData(name, value) {
      let row = this.col.data.findOne({ name });
      !row && (row = this.col.data.insert({ name }));
      row.value = typeof value == 'function' ? value(row) : value;
      this.col.data.update(row);
    }

    /**
     * @see Database.prototype.getData
     */
    async getData(name) {
      const row = this.col.data.findOne({ name });
      return row.value;
    }

    /**
     * @see Database.prototype.isMaster
     */
    async isMaster() {
      return !!(this.col.servers.chain().find({ isSlave: true, isBroken: false }).count());
    }

    /**
     * @see Database.prototype.getServer
     */
    async getServer(address) {
      return this.col.servers.findOne({ address });
    }

    /**
     * @see Database.prototype.getServers
     */
    async getServers() {
      return this.col.servers.find();
    }

    /**
     * @see Database.prototype.hasSlave
     */
    async hasSlave(address) {
      return !!(this.col.servers.chain().find({ isSlave: true, isBroken: false, address }).count());
    }

    /**
     * @see Database.prototype.getSlaves
     */
    async getSlaves() {
      return this.col.servers.chain().find({ isSlave: true, isBroken: false }).data();
    }

    /**
     * @see Database.prototype.getMaster
     */
    async getMaster(address) {
      return this.col.servers.findOne({ address, isMaster: true, isBroken: false });
    }

    /**
     * @see Database.prototype.getMasters
     */
    async getMasters() {
      return this.col.servers.chain().find({ isMaster: true, isBroken: false }).data();
    }

    /**
     * @see Database.prototype.getBacklink
     */
    async getBacklink() {
      return this.col.servers.findOne({ isBacklink: true, isBroken: false });
    }

    /**
     * @see Database.prototype.getMastersCount
     */
    async getMastersCount() {
      return this.col.servers
        .chain()
        .find({
          isMaster: true,
          isBroken: false
        })
        .count();
    }

    /**
     * @see Database.prototype.getSlavesCount
     */
    async getSlavesCount() {
      return this.col.servers.chain().find({ isSlave: true, isBroken: false }).count();
    }

    /**
     * @see Database.prototype.addMaster
     */
    async addMaster(address, size) {
      let server = this.col.servers.findOne({ address });

      if (server) {
        server.isMaster = true;
        server.updatedAt = Date.now();
        size !== undefined && (server.size = size);
        return this.col.servers.update(server);
      }

      return this.col.servers.insert(this.createServerFields({
        address,
        size,
        isMaster: true,
        level: 1
      }));
    }

    /**
     * @see Database.prototype.addSlave
     */
    async addSlave(address) {
      let server = this.col.servers.findOne({ address });

      if (server) {
        server.isSlave = true;
        server.updatedAt = Date.now();
        return this.col.servers.update(server);
      }

      server = this.col.servers.insert(this.createServerFields({
        address,
        isSlave: true
      }));
      const master = await this.getMaster(this.node.address);

      if (master) {
        master.size += 1;
        master.updatedAt = Date.now();
        this.col.servers.update(master);
      }

      return server;
    }

    /**
     * @see Database.prototype.addBacklink
     */
    async addBacklink(address) {
      let server = this.col.servers.findOne({ address });

      if (server) {
        server.isBacklink = true;
        server.updatedAt = Date.now();
        this.col.servers.update(server);
      }
      else {
        server = this.col.servers.insert(this.createServerFields({
          address,
          isBacklink: true
        }));
      }

      this.col.servers.chain()
        .find({
          isBacklink: true,
          address: { $ne: server.address }
        })
        .remove();
    }

    /**
     * @see Database.prototype.removeMaster
     */
    async removeMaster(address) {
      let server = this.col.servers.findOne({ address, isMaster: true });

      if (!server) {
        return;
      }

      if (server.isSlave || server.isBacklink) {
        server.updatedAt = Date.now();
        server.isMaster = false;
        server.size = 0;
        return this.col.servers.update(server);
      }

      this.col.servers.remove(server);
    }

    /**
     * @see Database.prototype.removeMasters
     */
    async removeMasters() {
      const servers = this.col.servers.find({ isMaster: true });

      for (let i = 0; i < servers.length; i++) {
        await this.removeMaster(servers[i].address);
      }
    }
    async removeServer(address) {
      this.col.servers.chain().find({ address }).remove();
    }

    /**
     * @see Database.prototype.removeSlave
     */
    async removeSlave(address) {
      let server = this.col.servers.findOne({ address });

      if (!server) {
        return;
      }

      if (server.isMaster || server.isBacklink) {
        server.updatedAt = Date.now();
        server.isSlave = false;
        return this.col.servers.update(server);
      }

      this.col.servers.remove(server);
      const master = await this.getMaster(this.node.address);

      if (master) {
        master.size -= 1;
        master.updatedAt = Date.now();
        this.col.servers.update(master);
      }
    }

    /**
     * @see Database.prototype.removeSlaves
     */
    async removeSlaves() {
      const servers = this.col.servers.find({ isSlave: true });

      for (let i = 0; i < servers.length; i++) {
        await this.removeSlave(servers[i].address);
      }
    }

    /**
     * @see Database.prototype.shiftSlaves
     */
    async shiftSlaves(limit = 1) {
      const servers = this.col.servers
        .chain()
        .find({ isSlave: true })
        .simplesort('createdAt', true)
        .limit(limit)
        .data();

      for (let i = 0; i < servers.length; i++) {
        await this.removeSlave(servers[i].address);
      }
    }

    /**
     * @see Database.prototype.removeBacklink
     */
    async removeBacklink() {
      let server = this.col.servers.findOne({ isBacklink: true });

      if (!server) {
        return;
      }

      if (server.isSlave || server.isMaster) {
        server.updatedAt = Date.now();
        server.isBacklink = false;
        this.col.servers.update(server);
      }
      else {
        this.col.servers.remove(server);
      }
      
      this.col.servers.chain()
        .find({
          isBacklink: true,
          address: { $ne: server.address }
        })
        .remove();
    }

    /**
     * @see Database.prototype.normalizeServers
     */
    async normalizeServers() {
      this.col.servers
        .chain()
        .find({
          isBroken: true,
          $or: [{
            fails: { $lte: this.node.options.network.serverMaxFails }
          }, {
            address: this.node.address
          }]
        })
        .update((obj) => {
          obj.isBroken = false;
          return obj;
        });
      this.col.servers
        .chain()
        .find({
          isBroken: false,
          fails: { $gt: this.node.options.network.serverMaxFails },
          address: { $ne: this.node.address }
        })
        .update((obj) => {
          obj.isBroken = true;
          return obj;
        });
      this.col.servers
        .chain()
        .find({
          $or: [
            {
              isSlave: true,
              address: this.node.address
            },
            {
              isBacklink: true,
              address: this.node.address
            },
            {
              isSlave: false,
              isBacklink: false,
              isMaster: false
            }
          ]
        })
        .remove();
    }

    /**
     * @see Database.prototype.successServerAddress
     */
    async successServerAddress(address) {
      let server = this.col.servers.findOne({ address });

      if (server) {
        server.fails = 0;
        server.isBroken = false;
        this.col.servers.update(server);
      }
    }

    /**
     * @see Database.prototype.failedServerAddress
     */
    async failedServerAddress(address) {
      if (address == this.node.address) {
        return;
      }

      let server = this.col.servers.findOne({ address });

      if (!server) {
        return false;
      }

      server.fails += 1;

      if (server.fails > this.node.options.network.serverMaxFails) {
        server.isBroken = true;
      }

      this.col.servers.update(server);
    }

    /**
     * @see Database.prototype.getBehaviorCandidates
     */
    async getBehaviorCandidates(action) {
      return this.col.behaviorCandidates
        .chain()
        .find({
          action,
          suspicion: {
            $gte: await this.node.getCandidateSuspicionLevel()
          }
        })
        .data();
    }

    /**
     * @see Database.prototype.addBehaviorCandidate
     */
    async addBehaviorCandidate(action, address) {
      if (await this.node.isAddressTrusted(address)) {
        return;
      }

      const data = this.col.behaviorCandidates.chain().find({ action }).simplesort('updatedAt', true).limit(1).data();
      const last = data.length ? data[0] : null;

      if (last && last.address != address) {
        const step = await this.node.getCandidateExcuseStep();
        this.col.behaviorCandidates
          .chain()
          .find({
            address: { $ne: address },
            excuse: { $lt: await this.node.getCandidateMaxSuspicionLevel() }
          })
          .update((obj) => {
            obj.excuse += step;
            return obj;
          });
      }

      this.col.behaviorCandidates
        .chain()
        .where((obj) => obj.excuse >= obj.suspicion)
        .remove();
      const candidate = this.col.behaviorCandidates.findOne({ address, action });

      if (candidate) {
        candidate.suspicion += 1;
        return this.col.behaviorCandidates.update(candidate);
      }

      const opts = { action, address };
      return this.col.behaviorCandidates.insert(this.createBehaviorCandidateFields(opts));
    }

    /**
     * @see Database.prototype.normalizeBehaviorCandidates
     */
    async normalizeBehaviorCandidates() {
      const suspicion = await this.node.getCandidateSuspicionLevel();
      this.col.behaviorCandidates
        .chain()
        .find({
          suspicion: { $gt: suspicion }
        })
        .update((obj) => {
          obj.suspicion = suspicion;
          return obj;
        });
      this.col.behaviorCandidates
        .chain()
        .where((obj) => obj.excuse >= obj.suspicion)
        .remove();
    }

    /**
     * @see Database.prototype.addApproval
     */
    async addApproval(action, clientIp, key, startedAt, info) {
      if (!await this.node.getApproval(action)) {
        throw new Error(`Approval ${action} doesn't exist`);
      }

      const usedBy = [];
      const updatedAt = Date.now();
      clientIp = utils.isIpv6(clientIp) ? utils.getFullIpv6(clientIp) : utils.ipv4Tov6(clientIp);
      const approval = this.col.approval.findOne({ action, clientIp });

      if (approval) {
        Object.assign(approval, { key, info, clientIp, startedAt, usedBy, updatedAt });
        return this.col.approval.update(approval);
      }

      return this.col.approval.insert({ action, clientIp, key, info, startedAt, usedBy, updatedAt });
    }

    /**
     * @see Database.prototype.getApproval
     */
    async getApproval(key) {
      const approval = this.col.approval.findOne({ key });
      return approval || null;
    }

    /**
     * @see Database.prototype.useApproval
     */
    async useApproval(key, address) {
      const approval = this.col.approval.findOne({ key });

      if (!approval.usedBy.includes(address)) {
        approval.usedBy.push(address);
        approval.updatedAt = Date.now();
      }

      this.col.approval.update(approval);
    }

    /**
     * @see Database.prototype.startApproval
     */
    async startApproval(key, answer) {
      const approval = this.col.approval.findOne({ key });
      approval.answer = answer;
      approval.updatedAt = Date.now();
      this.col.approval.update(approval);
    }

    /**
     * @see Database.prototype.normalizeApproval
     */
    async normalizeApproval() {
      const data = this.col.approval.find();
      const now = Date.now();

      for (let i = 0; i < data.length; i++) {
        const approver = data[i];
        const approval = await this.node.getApproval(approver.action);
        if (approver.updatedAt < now - approval.period) {
          this.col.approval.remove(approver);
          continue;
        }
      }
    }

    /**
     * @see Database.prototype.addBehaviorDelay
     */
    async addBehaviorDelay(action, address) {
      const behavior = this.col.behaviorDelays.findOne({ address, action });

      if (behavior) {
        behavior.updatedAt = Date.now();
        return this.col.behaviorDelays.update(behavior);
      }

      return this.col.behaviorDelays.insert(this.createBehaviorDelaysFields({ address, action }));
    }

    /**
     * @see Database.prototype.getBehaviorDelay
     */
    async getBehaviorDelay(action, address) {
      return this.col.behaviorDelays.findOne({ address, action });
    }

    /**
     * @see Database.prototype.removeBehaviorDelay
     */
    async removeBehaviorDelay(action, address) {
      const behavior = this.col.behaviorDelays.findOne({ address, action });
      if (behavior) {
        this.col.behaviorDelays.remove(behavior);
      }
    }

    /**
     * @see Database.prototype.cleanBehaviorDelays
     */
    async cleanBehaviorDelays(action) {
      this.col.behaviorDelays.chain().find({ action }).remove();
    }

    /**
     * @see Database.prototype.getBehaviorFail
     */
    async getBehaviorFail(action, address) {
      return this.col.behaviorFails.findOne({ address, action });
    }

    /**
     * @see Database.prototype.addBehaviorFail
     */
    async addBehaviorFail(action, address, step = 1) {
      if (!await this.node.getBehavior(action)) {
        throw new Error(`Behavior ${action} doesn't exist`);
      }
      
      if (await this.node.isAddressTrusted(address)) {
        return;
      }

      const behavior = this.col.behaviorFails.findOne({ address, action });
      typeof step == 'function' && (step = step(behavior));

      if (behavior) {
        behavior.suspicion += step;
        behavior.balance += 1;
        behavior.up += 1;
        behavior.down = 0;
        behavior.updatedAt = Date.now();
        return this.col.behaviorFails.update(behavior);
      }

      const opts = { address, action, suspicion: step, up: 1, balance: 1 };
      return this.col.behaviorFails.insert(this.createBehaviorFailsFields(opts));
    }

    /**
     * @see Database.prototype.subBehaviorFail
     */
    async subBehaviorFail(action, address, step = 1) {
      const behavior = this.col.behaviorFails.findOne({ address, action });

      if (!behavior) {
        return;
      }

      typeof step == 'function' && (step = step(behavior));
      behavior.suspicion -= step;
      behavior.balance > 0 && (behavior.balance -= 1);
      behavior.up = 0;
      behavior.down += 1;

      if (behavior.suspicion <= 0) {
        return this.col.behaviorFails.remove(behavior);
      }

      behavior.updatedAt = Date.now();
      return this.col.behaviorFails.update(behavior);
    }

    /**
     * @see Database.prototype.cleanBehaviorFail
     */
    async cleanBehaviorFail(action, address) {
      const behavior = this.col.behaviorFails.findOne({ address, action });

      if (!behavior) {
        return;
      }

      this.col.behaviorFails.remove(behavior);
    }

    /**
     * @see Database.prototype.normalizeBehaviorFails
     */
    async normalizeBehaviorFails() {
      const data = this.col.behaviorFails.find();
      const syncLifetime = await this.node.getSyncLifetime();
      const now = Date.now();

      for (let i = 0; i < data.length; i++) {
        const behavior = data[i];
        const options = await this.node.getBehavior(behavior.action);

        if (!options) {
          this.col.behaviorFails.remove(behavior);
          continue;
        }

        const lifetime = options.failLifetime == 'auto' ? syncLifetime : options.failLifetime;

        if (behavior.updatedAt < now - lifetime) {
          this.col.behaviorFails.remove(behavior);
          continue;
        }
        
        const delay = options.banDelay == 'auto' ? lifetime * 2 : options.banDelay;
       
        if (options.ban && behavior.suspicion > options.failSuspicionLevel && now - behavior.createdAt > delay) {
          await this.addBanlistAddress(behavior.address, options.banLifetime, behavior.action);
          this.col.behaviorFails.remove(behavior);
        }
      }
    }

    /**
     * @see Database.prototype.getBanlist
     */
    async getBanlist() {
      return this.col.banlist.find();
    }

    /**
     * @see Database.prototype.getBanlistAddress
     */
    async getBanlistAddress(address) {
      return this.col.banlist.findOne({ address });
    }

    /**
     * @see Database.prototype.checkBanlistIp
     */
    async checkBanlistIp(ip) {
      return !!this.col.banlist.findOne({ ip });
    }

    /**
     * @see Database.prototype.addBanlistAddress
     */
    async addBanlistAddress(address, lifetime, reason) {
      if (await this.node.isAddressTrusted(address)) {
        return;
      }

      let ip = await utils.getAddressIp(address);
      ip = utils.isIpv6(ip) ? utils.getFullIpv6(ip) : utils.ipv4Tov6(ip);
      const server = this.col.banlist.findOne({ address });
      const now = Date.now();
      let resolvedAt = now + lifetime;
      
      if (server) {
        server.updatedAt = now;
        server.resolvedAt = resolvedAt;
        server.ip = ip;
        reason !== undefined && (server.reason = reason);
        return this.col.banlist.update(server);
      }

      return this.col.banlist.insert(this.createBanlistFields({ address, ip, resolvedAt, reason }));
    }

    /**
     * @see Database.prototype.removeBanlistAddress
     */
    async removeBanlistAddress(address) {
      const server = this.col.banlist.findOne({ address });
      
      if (server) {
        return this.col.banlist.remove(server);
      }
    }

    /**
     * @see Database.prototype.emptyBanlist
     */
    async emptyBanlist() {
      return this.col.banlist.chain().find().remove();
    }

    /**
     * @see Database.prototype.normalizeBanlist
     */
    async normalizeBanlist() {
      this.col.banlist
        .chain()
        .find({
          resolvedAt: { $lt: Date.now() }
        })
        .remove();
    }

    /**
     * @see Database.prototype.getCache
     */
    async getCache(type, key) {
      const cache = this.col.cache.findOne({ type, key });

      if (cache) {
        cache.accessedAt = Date.now();
        return this.col.cache.update(cache);
      }

      return cache;
    }

    /**
     * @see Database.prototype.setCache
     */
    async setCache(type, key, value, options = {}) {
      let cache = this.col.cache.findOne({ type, key });
      const now = Date.now();

      if (cache) {
        cache.value = value;
        cache.accessedAt = now;
        return this.col.cache.update(cache);
      }
      
      cache = this.col.cache.insert({ type, key, value, accessedAt: now, createdAt: now });
      options.limit && this.col.cache.chain().find({ type }).simplesort('accessedAt', true).offset(options.limit).remove();
      return cache;
    }

    /**
     * @see Database.prototype.removeCache
     */
    async removeCache(type, key) {
      const cache = this.col.cache.findOne({ type, key });
      cache && this.col.cache.remove(cache);
    }

    /**
     * @see Database.prototype.normalizeCache
     */
    async normalizeCache(type, options = {}) {
      options.limit && this.col.cache.chain().find({ type }).simplesort('accessedAt', true).offset(options.limit).remove();
      options.lifetime && this.col.cache.chain().find({ type, createdAt: { $lt: Date.now() - options.lifetime } }).remove();
    }

    /**
     * @see Database.prototype.flushCache
     */
    async flushCache(type) {
      this.col.cache.chain().find({ type }).remove();
    }
  };
};
