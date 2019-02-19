const Database = require('../database')();
const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const loki = require('lokijs');
const utils = require('../../../utils');
const onExit = require('signal-exit');

module.exports = (Parent) => {
  /**
   * Lokijs database transport
   */
  return class DatabaseLoki extends (Parent || Database) {
    constructor(node, options = {}) {

      options = _.merge({
        filename: path.join(process.cwd(), node.constructor.name, `loki-${node.port}.db`),
        autosaveInterval: 3000
      }, options)

      super(node, options);
      this.col = {};
    }

    /**
     * @see Database.propotype.init
     */
    async init() { 
      await fs.ensureDir(path.dirname(this.options.filename));

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
          fs.writeFileSync(this.loki.filename, this.loki.serialize());
        }
      });

      await super.init();
    }

    /**
     * @see Database.propotype.deinit
     */
    async deinit() {
      await this.saveDatabase();
      this.__onExitListenerRemoveFn && this.__onExitListenerRemoveFn();
      delete this.__onExitListenerRemoveFn;
      delete this.loki;
      await super.deinit();
    }
  
    /**
     * @see Database.propotype.destroy
     */
    async destroy() {
      this.loki.autosaveDisable();
      await this.deleteDatabase();
      delete this.loki;
      await super.destroy();
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
      this.initCollectionData();
      this.initCollectionServers();
      this.initCollectionBanlist();
      this.initCollectionBehaviorCandidates();
      this.initCollectionBehaviorDelays();
      this.initCollectionBehaviorFails();   
    }

    /**
     * Initialize the data collection
     */
    initCollectionData() {
      this.col.data = this.loki.getCollection("data");

      if (this.col.data === null) {
        this.col.data = this.loki.addCollection('data', {
          unique: ['name']
        });
      }

      const masterRequestTime = this.col.data.findOne({ name: 'masterStatusTime' });
      const registrationTime = this.col.data.findOne({ name: 'registrationTime' });

      if(!masterRequestTime) {
        this.col.data.insert({ name: 'masterStatusTime', value: null });
      }

      if(!registrationTime) {
        this.col.data.insert({ name: 'registrationTime', value: null });
      }
    }

    /**
     * Initialize the servers collection
     */
    initCollectionServers() {
      this.col.servers = this.loki.getCollection("servers");

      if (this.col.servers === null) {
        this.col.servers = this.loki.addCollection('servers', { 
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
        updatedAt: now
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
        balance: 0
      }, obj);
    }

    /**
     * @see Database.propotype.setData
     */
    async setData(name, value) {
      const row = this.col.data.findOne({ name });
      row.value = typeof value == 'function'? value(row): value;
      this.col.data.update(row);
    }

   /**
     * @see Database.propotype.getData
     */
    async getData(name) {
      const row = this.col.data.findOne({ name });
      return row.value;
    }

    /**
     * @see Database.propotype.isMaster
     */
    async isMaster() {
      return !!(this.col.servers.chain().find({ isSlave: true, isBroken: false }).count());
    }  
    
    /**
     * @see Database.propotype.getServer
     */
    async getServer(address) {
      return this.col.servers.findOne({ address });
    }

    /**
     * @see Database.propotype.getServers
     */
    async getServers() {
      return this.col.servers.find();
    }

    /**
     * @see Database.propotype.hasSlave
     */
    async hasSlave(address) {
      return !!(this.col.servers.chain().find({ isSlave: true, isBroken: false, address }).count());
    }

    /**
     * @see Database.propotype.getSlaves
     */
    async getSlaves() {
      return this.col.servers.chain().find({ isSlave: true, isBroken: false }).data();
    }

    /**
     * @see Database.propotype.getMaster
     */
    async getMaster(address) {
      return this.col.servers.findOne({ address, isMaster: true, isBroken: false });
    }

    /**
     * @see Database.propotype.getMasters
     */
    async getMasters() {
      return this.col.servers.chain().find({ isMaster: true, isBroken: false }).data();
    }

    /**
     * @see Database.propotype.getBacklink
     */
    async getBacklink() {
      return this.col.servers.findOne({ isBacklink: true, isBroken: false });
    }

    /**
     * @see Database.propotype.getMastersCount
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
     * @see Database.propotype.getSlavesCount
     */
    async getSlavesCount() {
      return this.col.servers.chain().find({ isSlave: true, isBroken: false }).count();
    }
    
    /**
     * @see Database.propotype.addMaster
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
     * @see Database.propotype.addSlave
     */
    async addSlave(address) {
      let server = this.col.servers.findOne({ address });

      if(server) {
        server.isSlave = true;
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
     * @see Database.propotype.addBacklink
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
     * @see Database.propotype.removeMaster
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
     * @see Database.propotype.removeMasters
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
     * @see Database.propotype.removeSlave
     */
    async removeSlave(address) {
      let server = this.col.servers.findOne({ address });

      if(!server) {
        return;
      }

      if(server.isMaster || server.isBacklink) {
        server.isSlave = false;
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
     * @see Database.propotype.removeSlaves
     */
    async removeSlaves() {
      const servers = this.col.servers.find({ isSlave: true });

      for(let i = 0; i < servers.length; i++) {        
        await this.removeSlave(servers[i].address);
      }
    }

    /**
     * @see Database.propotype.shiftSlaves
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
     * @see Database.propotype.removeBacklink
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
     * @see Database.propotype.normalizeServers
     */
    async normalizeServers() {
      this.col.servers
        .chain()
        .find({ 
          isBroken: true,
          fails: { $lte: this.node.options.network.serverMaxFails }         
        })
        .update((obj) => {
          obj.isBroken = false;
          return obj;
        });

      this.col.servers
        .chain()
        .find({
          isBroken: false,
          fails: { $gt: this.node.options.network.serverMaxFails }
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
            fails: {
              $gt: this.node.options.network.serverMaxFails
            }
          }, {
            isSlave: false, 
            isBacklink: false,
            isMaster: false
          }]          
        })
        .remove();
    }

    /**
     * @see Database.propotype.successServerAddress
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
     * @see Database.propotype.failedServerAddress
     */
    async failedServerAddress(address) {
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
     * @see Database.propotype.getBehaviorCandidates
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
     * @see Database.propotype.addBehaviorCandidate
     */
    async addBehaviorCandidate(address, action) {
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
     * @see Database.propotype.normalizeBehaviorCandidates
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
     * @see Database.propotype.addBehaviorDelay
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
     * @see Database.propotype.getBehaviorDelay
     */
    async getBehaviorDelay(action, address) {
      return this.col.behaviorDelays.findOne({ address, action });
    }

    /**
     * @see Database.propotype.removeBehaviorDelay
     */
    async removeBehaviorDelay(action, address) {
      const behavior = this.col.behaviorDelays.findOne({ address, action });

      if(behavior) {
        this.col.behaviorDelays.remove(behavior);
      }
    }

    /**
     * @see Database.propotype.clearBehaviorDelays
     */
    async clearBehaviorDelays(action) {
      this.col.behaviorDelays.chain().find({ action }).remove();
    }

    /**
     * @see Database.propotype.getBehaviorFail
     */
    async getBehaviorFail(action, address) {
      return this.col.behaviorFails.findOne({ address, action });
    }

    /**
     * @see Database.propotype.addBehaviorFail
     */
    async addBehaviorFail(action, address, step = 1) {
      const behavior = this.col.behaviorFails.findOne({ address, action });

      if(behavior) {
        typeof step == 'function' && (step = step(behavior));
        behavior.suspicion += step;
        behavior.balance += 1;
        behavior.updatedAt = Date.now();
        return this.col.behaviorFails.update(behavior);
      }

      return this.col.behaviorFails.insert(this.createBehaviorFailsFields({ address, action }));
    }

    /**
     * @see Database.propotype.subBehaviorFail
     */
    async subBehaviorFail(action, address, step = 1) {
      const behavior = this.col.behaviorFails.findOne({ address, action });

      if(!behavior) {
        return;
      }

      typeof step == 'function' && (step = step(behavior));
      behavior.suspicion -= step;
      behavior.balance > 0 && (behavior.balance -= 1);

      if(behavior.suspicion <= 0) {
        return this.col.behaviorFails.remove(behavior);
      }

      behavior.updatedAt = Date.now();
      this.col.behaviorFails.update(behavior);
    }

    /**
     * @see Database.propotype.normalizeBehaviorFails
     */
    async normalizeBehaviorFails() {
      this.col.banlist
        .chain()
        .find({ 
          updatedAt: {
            $lt: Date.now() - this.node.options.behavior.failLifetime 
          } 
        })
        .remove();

      if(this.node.options.network.isTrusted) {
        return;
      }

      const data = this.col.behaviorFails
        .chain()
        .find({ 
          suspicion: {
            $gt: this.node.options.behavior.failSuspicionLevel 
          }
        })
        .data();

      const banned = [];

      for(let i = 0; i < data.length; i++) {
        const behavior = data[i];        
        await this.addBanlistAddress(behavior.address);
        banned.push(behavior.address);
      }

      this.col.behaviorFails
      .chain()
      .find({
        address: {
          $in: banned
        }
      })
      .remove();
    }

    /**
     * @see Database.propotype.getBanlist
     */
    async getBanlist() {
      return this.col.banlist.find();
    }

    /**
     * @see Database.propotype.getBanlistAddress
     */
    async getBanlistAddress(address) {
      return this.col.banlist.findOne({ address });
    }

    /**
     * @see Database.propotype.addBanlistAddress
     */
    async addBanlistAddress(address) {
      const ip = utils.getAddressIp(address);
      const server = this.col.banlist.findOne({ address });
      
      if(server) {
        server.updatedAt = Date.now();
        return this.col.banlist.update(server);
      }

      return this.col.banlist.insert(this.createBanlistFields({ address, ip }));
    }

    /**
     * @see Database.propotype.removeBanlistAddress
     */
    async removeBanlistAddress(address) {
      const server = this.col.banlist.findOne({ address });
      
      if(server) {
        return this.col.banlist.remove(server);
      }
    }

    /**
     * @see Database.propotype.normalizeBanlist
     */
    async normalizeBanlist() {
      this.col.banlist
        .chain()
        .find({ 
          updatedAt: { 
            $lt: Date.now() - this.node.options.network.banLifetime 
          } 
        })
        .remove();
    }
  }
};