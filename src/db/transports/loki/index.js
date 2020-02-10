const Database = require('../database')();
const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const loki = require('lokijs');
const LokiFsSyncAdapter = require('lokijs/src/loki-fs-sync-adapter.js');  
const utils = require('../../../utils');
const onExit = require('signal-exit');

module.exports = (Parent) => {
  /**
   * Lokijs database transport
   */
  return class DatabaseLoki extends (Parent || Database) {
    constructor(node, options = {}) {
      options = _.merge({
        filename: path.join(node.storagePath, 'loki.db'),
        autosaveInterval: 3000
      }, options);

      super(node, options);
      this.col = {};
      this.__behaviorFailOptions = {};
    }

    /**
     * @see Database.prototype.init
     */
    async init() {
      await fs.ensureFile(this.options.filename);

      await new Promise((resolve, reject) => {     
        this.loki = new loki(this.options.filename, _.merge(this.options, {
          autoload: true,
          autosave: true,
          autoloadCallback: (err) => {
            if(err) {
              return reject(err);
            }

            this.initCollections();
            resolve();
          }
        }));
      });        

      this.__onExitListenerRemoveFn = onExit(() => {
        if(this.loki && this.__initialized) {                
          this.loki.persistenceMethod = 'adapter';
          this.loki.persistenceAdapter = new LokiFsSyncAdapter();
          this.saveDatabase();
        }
      });

      super.init.apply(this, arguments);
    }

    /**
     * @see Database.prototype.deinit
     */
    async deinit() {
      this.__onExitListenerRemoveFn && this.__onExitListenerRemoveFn();

      if(this.isDestroying()) {
        this.loki.autosaveDisable();
        await this.deleteDatabase();          
      }
      else {
        await this.saveDatabase(); 
        this.loki && this.loki.close();
      }

      delete this.loki;
      await super.deinit.apply(this, arguments);
    }

    /**
     * Save the database
     * 
     * @async
     */
    async saveDatabase() {
      if(!this.loki) {
        return;
      }

      return new Promise((resolve, reject) => {
        this.loki.saveDatabase((err) => {
          if(err) {
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
      if(!this.loki || !(await fs.pathExists(this.loki.filename))) {
        return;
      }

      return new Promise((resolve, reject) => {        
        this.loki.deleteDatabase((err) => {
          if(err) {
            return reject(err);
          }
  
          resolve();
        });
      });
    }

    /**
     * Initialize all collections
     */
    initCollections() {      
      this.initCollectionCache();
      this.initCollectionData();
      this.initCollectionServers();
      this.initCollectionBanlist();
      this.initCollectionBehaviorCandidates();
      this.initCollectionBehaviorDelays();
      this.initCollectionBehaviorFails();   
    }

    /**
     * Initialize cache collection
     */
    initCollectionCache() {
      this.col.cache = this.loki.getCollection("cache");

      if (this.col.cache === null) {
        this.col.cache = this.loki.addCollection('cache', {
          disableMeta: true,
          indices: ['type']
        });
      }
    }

    /**
     * Initialize the data collection
     */
    initCollectionData() {
      this.col.data = this.loki.getCollection("data");

      if (this.col.data === null) {
        this.col.data = this.loki.addCollection('data', {
          disableMeta: true,
          unique: ['name']
        });
      }

      const masterRequestTime = this.col.data.findOne({ name: 'masterStatusTime' });
      const registrationTime = this.col.data.findOne({ name: 'registrationTime' });
      const checkedMasterStructures = this.col.data.findOne({ name: 'checkedMasterStructures' });
      const members = this.col.data.findOne({ name: 'members' });

      if(!masterRequestTime) {
        this.col.data.insert({ name: 'masterStatusTime', value: null });
      }

      if(!registrationTime) {
        this.col.data.insert({ name: 'registrationTime', value: null });
      }

      if(!checkedMasterStructures) {
        this.col.data.insert({ name: 'checkedMasterStructures', value: [] });
      }

      if(!members) {
        this.col.data.insert({ name: 'members', value: [] });
      }
    }

    /**
     * Initialize the servers collection
     */
    initCollectionServers() {
      this.col.servers = this.loki.getCollection("servers");

      if (this.col.servers === null) {
        this.col.servers = this.loki.addCollection('servers', { 
          disableMeta: true,
          unique: ['address']
        });
      }
    }

    /**
     * Initialize the banlist collection
     */
    initCollectionBanlist() {
      this.col.banlist = this.loki.getCollection("banlist");

      if (this.col.banlist === null) {
        this.col.banlist = this.loki.addCollection('banlist', { 
          disableMeta: true,
          unique: ['address']
        });
      }
    }

    /**
     * Initialize the candidates behavior collection
     */
    initCollectionBehaviorCandidates() {
      this.col.behaviorCandidates = this.loki.getCollection("behaviorCandidates");

      if (this.col.behaviorCandidates === null) {
        this.col.behaviorCandidates = this.loki.addCollection('behaviorCandidates', {
          disableMeta: true,
          indices: ['address', 'action']
        });
      }
    }

    /**
     * Initialize the delays behavior collection
     */
    initCollectionBehaviorDelays() {
      this.col.behaviorDelays = this.loki.getCollection("behaviorDelays");

      if (this.col.behaviorDelays === null) {
        this.col.behaviorDelays = this.loki.addCollection('behaviorDelays', {
          disableMeta: true,
          indices: ['address', 'action']
        });
      }
    }

    /**
     * Initialize the fails behavior collection
     */
    initCollectionBehaviorFails() {
      this.col.behaviorFails = this.loki.getCollection("behaviorFails");

      if (this.col.behaviorFails === null) {
        this.col.behaviorFails = this.loki.addCollection('behaviorFails', {
          disableMeta: true,
          indices: ['address', 'action']
        });
      }
    }    

    /**
     * Create the server collection fields
     * 
     * @param {object} [obj]
     * @returns {object}
     */
    createServerFields(obj = {}) {
      const now = Date.now();

      const fields = _.merge({
        size: 0,
        createdAt: now,
        updatedAt: now,
        fails: 0,
        availability: 0,
        isSlave: false,
        isBacklink: false,
        isMaster: false,
        isBroken: false,
        chain: []
      }, obj);

      if(!fields.createdAt) {
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

      return  _.merge({
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

      return  _.merge({
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

      return  _.merge({
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

      return  _.merge({
        createdAt: now,
        updatedAt: now,
        suspicion: 1,
        balance: 1
      }, obj);
    }

    /**
     * @see Database.prototype.setData
     */
    async setData(name, value) {
      let row = this.col.data.findOne({ name });
      !row && (row = this.col.data.insert({ name }));
      row.value = typeof value == 'function'? value(row): value;
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

      if(server) {
        server.isMaster = true;
        server.updatedAt = Date.now();
        size !== undefined && (server.size = size);
        return this.col.servers.update(server);
      }
      
      return this.col.servers.insert(this.createServerFields({
        address,
        size,
        isMaster: true
      }));
    }

    /**
     * @see Database.prototype.addSlave
     */
    async addSlave(address, availability) {
      let server = this.col.servers.findOne({ address });

      if(server) {
        server.isSlave = true;
        availability !== undefined && (server.availability = availability);
        return this.col.servers.update(server);
      }

      server = this.col.servers.insert(this.createServerFields({
        address,
        isSlave: true        
      }));

      const master = await this.getMaster(this.node.address);

      if(master) {
        master.size += 1;
        this.col.servers.update(master);
      }

      return server;
    }

    /**
     * @see Database.prototype.addBacklink
     */
    async addBacklink(address, chain) {
      let server = this.col.servers.findOne({ address });

      if(server) {
        server.isBacklink = true;
        server.chain = chain;
        this.col.servers.update(server);
      }
      else {
        server = this.col.servers.insert(this.createServerFields({
          address,
          chain,
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

      if(!server) {
        return;
      }

      if(server.isSlave || server.isBacklink) {
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

      for(let i = 0; i < servers.length; i++) {
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

      if(!server) {
        return;
      }

      if(server.isMaster || server.isBacklink) {
        server.isSlave = false;
        server.availability = 0;
        return this.col.servers.update(server);
      }

      this.col.servers.remove(server);
      const master = await this.getMaster(this.node.address);

      if(master) {
        master.size -= 1;
        this.col.servers.update(master);
      }
    }

    /**
     * @see Database.prototype.removeSlaves
     */
    async removeSlaves() {
      const servers = this.col.servers.find({ isSlave: true });

      for(let i = 0; i < servers.length; i++) {        
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

      for(let i = 0; i < servers.length; i++) {        
        await this.removeSlave(servers[i].address);
      }
    }

    /**
     * @see Database.prototype.removeBacklink
     */
    async removeBacklink() {
      let server = this.col.servers.findOne({ isBacklink: true });

      if(!server) {
        return;
      }

      if(server.isSlave || server.isMaster) {
        server.isBacklink = false;
        server.chain = [];
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
          $or: [{
            isSlave: true,              
            address: this.node.address
          }, {
            isBacklink: true,
            address: this.node.address
          }, {
            isSlave: false,
            isBacklink: false,
            isMaster: false
          }]          
        })
        .remove();
    }

    /**
     * @see Database.prototype.successServerAddress
     */
    async successServerAddress(address) {
      let server = this.col.servers.findOne({ address });

      if(server) {
        server.fails = 0;
        server.isBroken = false;
        this.col.servers.update(server);
      }
    }

    /**
     * @see Database.prototype.failedServerAddress
     */
    async failedServerAddress(address) {
      if(address == this.node.address) {
        return;
      }

      let server = this.col.servers.findOne({ address });

      if(!server) {
        return false;
      }

      server.fails += 1; 

      if(server.fails > this.node.options.network.serverMaxFails) {
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
        .data()
    }

    /**
     * @see Database.prototype.addBehaviorCandidate
     */
    async addBehaviorCandidate(action, address) {
      if(this.node.options.network.isTrusted) {
        return;
      }

      const data = this.col.behaviorCandidates.chain().find({ action }).simplesort('updatedAt', true).limit(1).data();
      const last = data.length? data[0]: null;  
      
      if(last && last.address != address) {
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
        .remove()

      const candidate = this.col.behaviorCandidates.findOne({ address, action });
     
      if(candidate) {
        candidate.suspicion += 1;
        return this.col.behaviorCandidates.update(candidate);
      }

      return this.col.behaviorCandidates.insert(this.createBehaviorCandidateFields({ action, address }));
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
        })

      this.col.behaviorCandidates
        .chain()
        .where((obj) => obj.excuse >= obj.suspicion)
        .remove()
    }

    /**
     * @see Database.prototype.addBehaviorDelay
     */
    async addBehaviorDelay(action, address) {
      const behavior = this.col.behaviorDelays.findOne({ address, action });

      if(behavior) {
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

      if(behavior) {
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
      if(address == this.node.address || this.node.options.network.isTrusted) {
        return;
      }
      
      const behavior = this.col.behaviorFails.findOne({ address, action });
      typeof step == 'function' && (step = step(behavior));

      if(behavior) {
        behavior.suspicion += step;
        behavior.balance += 1;
        behavior.updatedAt = Date.now();
        return this.col.behaviorFails.update(behavior);
      }

      return this.col.behaviorFails.insert(this.createBehaviorFailsFields({ address, action, suspicion: step }));
    }

    /**
     * @see Database.prototype.subBehaviorFail
     */
    async subBehaviorFail(action, address, step = 1) {
      const behavior = this.col.behaviorFails.findOne({ address, action });

      if(!behavior) {
        return;
      }

      typeof step == 'function' && (step = step(behavior));
      behavior.suspicion -= step;
      behavior.balance > 1 && (behavior.balance -= 1);

      if(behavior.suspicion <= 0) {
        return this.col.behaviorFails.remove(behavior);
      }

      behavior.updatedAt = Date.now();
      this.col.behaviorFails.update(behavior);
    }

     /**
     * @see Database.prototype.cleanBehaviorFail
     */
    async cleanBehaviorFail(action, address) {
      const behavior = this.col.behaviorFails.findOne({ address, action });

      if(!behavior) {
        return;
      }
      
      this.col.behaviorFails.remove(behavior);
    }

    /**
     * @see Database.prototype.addBehaviorFailOptions
     */
    async addBehaviorFailOptions(action, options) {
      options = Object.assign({}, options);
      options.banLifetime !== undefined && (options.banLifetime = utils.getMs(options.banLifetime));
      options.failLifetime !== undefined && (options.failLifetime = utils.getMs(options.failLifetime));
      return this.__behaviorFailOptions[action] = options;
    }

    /**
     * @see Database.prototype.getBehaviorFailOptions
     */
    async getBehaviorFailOptions(action) {
      return _.merge({}, this.node.options.behavior, this.__behaviorFailOptions[action] || {});
    }

    /**
     * @see Database.prototype.normalizeBehaviorFails
     */
    async normalizeBehaviorFails() {
      const data = this.col.behaviorFails.find();
      const now = Date.now();

      for(let i = 0; i < data.length; i++) {
        const behavior = data[i];
        const options = await this.getBehaviorFailOptions(behavior.action);
       
        if(behavior.updatedAt < now - options.failLifetime) {
          this.col.behaviorFails.remove(behavior);
          continue;
        }

        if(behavior.suspicion > options.failSuspicionLevel && options.ban) {
          await this.addBanlistAddress(behavior.address, options.banLifetime, behavior.action);
          this.col.behaviorFails.remove(behavior);
        }
      }
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
      if(address == this.node.address || this.node.options.network.isTrusted) {
        return;
      }

      let ip = await utils.getAddressIp(address);
      ip = utils.isIpv6(ip)? utils.getFullIpv6(ip): utils.ipv4Tov6(ip);
      const server = this.col.banlist.findOne({ address });
      const now = Date.now();
      let resolvedAt = now + lifetime;
      
      if(server) {
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
      
      if(server) {
        return this.col.banlist.remove(server);
      }
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

      if(cache) {
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

      if(cache) {
        cache.value = value;
        cache.accessedAt = Date.now();
        return this.col.cache.update(cache);
      }

      cache = this.col.cache.insert({ type, key, value, accessedAt: Date.now() });
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
      options.lifetime && this.col.cache.chain().find({ type, accessedAt: { $lt: Date.now() - options.lifetime } }).remove();      
    }
  }
};