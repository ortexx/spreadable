const Database = require('../database')();
const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const loki = require('lokijs');
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
      this.initCollectionCandidates();
    }

    /**
     * Initialize data collection
     */
    initCollectionData() {
      this.col.data = this.loki.getCollection("data");

      if (this.col.data === null) {
        this.col.data = this.loki.addCollection('data', {
          unique: ['name']
        });
      }
    }

    /**
     * Initialize servers collection
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
     * Initialize candidates collection
     */
    initCollectionCandidates() {
      this.col.candidates = this.loki.getCollection("candidates");

      if (this.col.candidates === null) {
        this.col.candidates = this.loki.addCollection('candidates', {
          indices: ['address', 'action']
        });
      }
    }

    /**
     * Create server collection fields
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
        delays: 0,
        isSlave: false,
        isBacklink: false,
        isMaster: false,
        isAccepted: true,
        isBroken: false,
        chain: []   
      }, obj);

      if(!fields.createdAt) {
        fields.createdAt = now;
      }

      return fields;
    }

    /**
     * Create candidate collection fields
     * 
     * @param {object} [obj]
     * @returns {object}
     */
    createCandidateFields(obj = {}) {
      const now = Date.now();

      return  _.merge({
        createdAt: now,
        updatedAt: now,
        suspicion: 0,
        exculpation: 0
      }, obj);
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
    async getMaster(address, onlyAccepted = true) {
      const filter = { address, isMaster: true, isBroken: false };
      onlyAccepted && (filter.isAccepted = true);
      return this.col.servers.findOne(filter);
    }

    /**
     * @see Database.propotype.getMasters
     */
    async getMasters(onlyAccepted = true) {
      const filter = { isMaster: true, isBroken: false };
      onlyAccepted && (filter.isAccepted = true);
      return this.col.servers.chain().find(filter).data();
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
    async getMastersCount(onlyAccepted = true) {
      const filter = { isMaster: true, isBroken: false };
      onlyAccepted && (filter.isAccepted = true);
      return this.col.servers.chain().find(filter).count();
    }

    /**
     * @see Database.propotype.getSlavesCount
     */
    async getSlavesCount() {
      return this.col.servers.chain().find({ isSlave: true, isBroken: false }).count();
    }    

    /**
     * @see Database.propotype.getNetworkSize
     */
    async getNetworkSize() {
      const count = this.col.servers
        .chain()
        .find({ isMaster: true, isBroken: false })
        .mapReduce(obj => obj, arr => arr.reduce((v, obj) => v + obj.size, 0));

      return count || 1;
    }
    
    /**
     * @see Database.propotype.addMaster
     */
    async addMaster(address, size, isAccepted = true, updatedAt = Date.now()) {
      let server = this.col.servers.findOne({ address });

      if(server) {
        server.isMaster = true;
        server.size = size;
        server.updatedAt = updatedAt;
        server.isAccepted = isAccepted;
        return this.col.servers.update(server);
      }
      
      return this.col.servers.insert(this.createServerFields({
        address,
        size,
        isAccepted,
        updatedAt,
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
      let server = this.col.servers.findOne({ address });

      if(!server) {
        return;
      }

      if(server.isSlave || server.isBacklink) {
        server.isMaster = false;
        server.size = 0;
        server.isAccepted = true;
        return this.col.servers.update(server);
      }

      this.col.servers.remove(server);
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
          $and: [{
            fails: { $lte: this.node.options.network.serverMaxFails }
          }, {
            delays: { $lte: this.node.options.network.serverMaxDelays }
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
          $or: [{
            fails: { $gt: this.node.options.network.serverMaxFails }
          }, {
            delays: { $gt: this.node.options.network.serverMaxDelays }
          }]
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
     * @see Database.propotype.decreaseServerDelays
     */
    async decreaseServerDelays(address) {
      let server = this.col.servers.findOne({ address });

      if(server) {
        server.delays = server.delays >= 1? server.delays - 1: 0;
        server.delays == 0 && (server.isBroken = false);
        this.col.servers.update(server);
      }
    }

    /**
     * @see Database.propotype.increaseServerDelays
     */
    async increaseServerDelays(address) {
      let server = this.col.servers.findOne({ address });

      if(!server) {
        return false;
      }

      server.delays += 1; 

      if(server.delays > this.node.options.network.serverMaxDelays) {
        server.isBroken = true;
      }

      this.col.servers.update(server);
    }

    /**
     * @see Database.propotype.getSuspiciousCandidates
     */
    async getSuspiciousCandidates(action) {
      return this.col.candidates
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
     * @see Database.propotype.addCandidate
     */
    async addCandidate(address, action) {
      const data = this.col.candidates.chain().find({ action }).simplesort('updatedAt', true).limit(1).data();
      const last = data.length? data[0]: null;  
      
      if(last && last.address != address) {
        const step = await this.node.getCandidateExculpationStep();
        
        this.col.candidates
          .chain()
          .find({ 
            address: { $ne: address },
            exculpation: { $lt: await this.node.getCandidateMaxSuspicionLevel() }
          })
          .update((obj) => {
            obj.exculpation += step;
            return obj;
          });
      }

      this.col.candidates
        .chain()
        .where((obj) => obj.exculpation >= obj.suspicion)
        .remove()

      const candidate = this.col.candidates.findOne({ address, action });
     
      if(candidate) {
        candidate.suspicion += 1;
        return this.col.candidates.update(candidate);
      }

      return this.col.candidates.insert(this.createCandidateFields({ action, address, suspicion: 1 }));
    }

    /**
     * @see Database.propotype.normalizeCandidates
     */
    async normalizeCandidates() {
      const suspicion = await this.node.getCandidateSuspicionLevel();
      
      this.col.candidates
        .chain()
        .find({
          suspicion: { $gt: suspicion }
        })
        .update((obj) => {
          obj.suspicion = suspicion;
          return obj;
        })

      this.col.candidates
        .chain()
        .where((obj) => obj.exculpation >= obj.suspicion)
        .remove()
    }
  }
};