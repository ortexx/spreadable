const ms = require('ms');
const v8 = require('v8');
const urlib = require('url');
const path = require('path');
const fse = require('fs-extra');
const _ = require('lodash');
const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const FormData = require('form-data');
const DatabaseLoki = require('./db/transports/loki')();
const ServerExpress = require('./server/transports/express')();
const LoggerConsole = require('./logger/transports/console')();
const TaskInterval = require('./task/transports/interval')();
const BehaviorFail = require('./behavior/transports/fail')();
const Service = require('./service')();
const utils = require('./utils');
const schema = require('./schema');
const errors = require('./errors');
const pack = require('../package.json');

module.exports = (Parent) => { 
  /**
   * The node class
   */
  return class Node extends (Parent || Service) {
    static get version () { return pack.version }
    static get codename () { return 'spreadable' }
    static get DatabaseTransport () { return DatabaseLoki }
    static get ServerTransport () { return ServerExpress }
    static get LoggerTransport () { return LoggerConsole }
    static get TaskTransport () { return TaskInterval }

    /**
     * @param {object} options
     * @param {object} options.port
     * @param {object} [options.initialNetworkAddress]
     */
    constructor(options = {}) {
      super(...arguments);

      if(!options.port) {
        throw new Error('You must pass the necessary port');
      }

      this.options = _.merge({
        hostname: '',  
        storage: {
          path: '',
        },
        request: {
          clientConcurrency: 50,
          serverTimeout: '2s',
          pingTimeout: '1s'
        },
        network: {
          autoSync: true,
          isTrusted: false,
          syncInterval: '16s',
          syncTimeCalculationPeriod: '1d',
          auth: null,
          authCookieMaxAge: '7d',
          serverMaxFails: 3,
          whitelist: [],
          blacklist: [],
          trustlist: []
        },
        server: {
          https: false,
          maxBodySize: '500kb',
          compressionLevel: 6
        },
        behavior: {          
          candidateSuspicionLevel: 5,
        },
        logger: {
          level: 'info'
        },
        task: {
          calculateCpuUsageInterval: '1s'
        }
      }, options);

      !this.options.logger && (this.options.logger = { level: false }); 
      typeof this.options.logger == 'string' && (this.options.logger = { level: this.options.logger });
      this.port = this.options.port;
      this.publicPort = this.options.publicPort || this.port;
      this.DatabaseTransport = this.constructor.DatabaseTransport;
      this.ServerTransport = this.constructor.ServerTransport;
      this.LoggerTransport = this.constructor.LoggerTransport;  
      this.TaskTransport = this.constructor.TaskTransport;
      this.__rootCheckedAt = 0;
      this.__rootNetworkAddress = '';
      this.__cpuUsageInterval = 900,
      this.__timeoutSlippage = 120;
      this.__initialized = false;
      this.__syncInterval = null;      
      this.__cpuUsage = 0;      
      this.__requestQueue = {};
      this.__syncList = [];
      this.__behavior = {};
      this.__approval = {};
      this.prepareOptions();
    }    

    /**
     * Initialize the node
     * 
     * @async
     */
    async init() {
      this.storagePath = this.options.storage.path || path.join(process.cwd(), this.constructor.codename, `storage-${this.port}`);      
      this.externalIp = await utils.getExternalIp();
      this.localIp = utils.getLocalIp();
      this.hostname = this.options.hostname || this.externalIp || this.localIp;
      this.address = utils.createAddress(this.hostname, this.publicPort);      
      this.ip = await utils.getHostIp(this.hostname);

      if(!this.ip) {
        throw new Error(`Hostname ${this.hostname} is not found`);
      }
      
      await fse.ensureDir(this.storagePath);
      await this.prepareServices();
      await this.prepareBehavior();
      await this.initServices(); 
      await super.init.apply(this, arguments);      
      await this.initBeforeSync();     

      if(!this.options.network.autoSync) {
        return;
      }

      const fn = async () => {
        try {
          await this.sync();
        }
        catch(err) {
          this.logger.error(err.stack);
        }  
      }

      this.__syncInterval = setInterval(fn, this.options.network.syncInterval);
      await fn();     
    }

    /**
     * Deinitialize the node
     * 
     * @async
     */
    async deinit() {
      this.__syncInterval && clearInterval(this.__syncInterval);
      !this.isDestroying() && await this.deinitServices();
      await super.deinit.apply(this, arguments);
    }

    /**
     * Destroy the node
     * 
     * @async
     */
    async destroy() { 
      await this.destroyServices();
      await super.destroy.apply(this, arguments);
    }

    /**
     * Initialize the node before sync
     * 
     * @async
     */
    async initBeforeSync() {
      const initialNetworkAddress = this.options.initialNetworkAddress || this.address;
      this.initialNetworkAddress = await this.getAvailableAddress(initialNetworkAddress);
      
      if(!this.initialNetworkAddress) {
        throw new Error('Provided initial network addresses are not available');
      }

      this.__rootNetworkAddress = await this.db.getData('rootNetworkAddress'); 

      if(!this.options.server) {
        return;
      }
      
      await this.nodeAddressTest(this.address);
    }

    /**
     * Prepare the services
     * 
     * @async
     */
    async prepareServices() {
      this.logger = new this.LoggerTransport(this, this.options.logger);
      this.db = new this.DatabaseTransport(this, this.options.db);
      this.options.server && (this.server = new this.ServerTransport(this, this.options.server));    
      this.options.task && (this.task = new this.TaskTransport(this, this.options.task));
      
      if(!this.task) {
        return;
      }

      if(this.options.task.calculateCpuUsageInterval) {
        await this.task.add('calculateCpuUsage', this.options.task.calculateCpuUsageInterval, () => this.calculateCpuUsage());
      }
    }

    /**
     * Prepare the behavior
     * 
     * @async
     */
    async prepareBehavior() {
      await this.addBehavior('requestDelays', new BehaviorFail(this, { banLifetime: '5m', failSuspicionLevel: 200 }));
      await this.addBehavior('authentication', new BehaviorFail(this, { banLifetime: '15m', failSuspicionLevel: 10 }));
      await this.addBehavior('registration', new BehaviorFail(this, { banLifetime: '10m' }));
      await this.addBehavior('slaveMasters', new BehaviorFail(this));
      await this.addBehavior('slaveBacklink', new BehaviorFail(this));
      await this.addBehavior('backlinkMasters', new BehaviorFail(this));
      await this.addBehavior('backlinkSlaves', new BehaviorFail(this));
      await this.addBehavior('masterMasters', new BehaviorFail(this));
      await this.addBehavior('masterSlaves', new BehaviorFail(this));
      await this.addBehavior('masterNetworkSize', new BehaviorFail(this));      
      await this.addBehavior('requestBacklinkMasters', new BehaviorFail(this));
      await this.addBehavior('responseSchema', new BehaviorFail(this));
    }

    /**
     * Initialize the services
     * 
     * @async
     */
    async initServices() {
      this.logger && await this.logger.init();   
      this.db && await this.db.init();
      this.server && await this.server.init();
      this.task && await this.task.init();

      for(let key in this.__approval) {
        await this.__approval[key].init();
      }

      for(let key in this.__behavior) {
        await this.__behavior[key].init();
      }
    }

    /**
     * Deinitialize the services
     * 
     * @async
     */
    async deinitServices() {
      for(let key in this.__approval) {
        await this.__approval[key].deinit();
      }

      for(let key in this.__behavior) {
        await this.__behavior[key].deinit();
      }

      this.task && await this.task.deinit();
      this.server && await this.server.deinit();
      this.db && await this.db.deinit();
      this.logger && await this.logger.deinit();
    }

    /**
     * Destroy the services
     * 
     * @async
     */
    async destroyServices() {
      for(let key in this.__approval) {
        await this.__approval[key].destroy();
      }

      for(let key in this.__behavior) {
        await this.__behavior[key].destroy();
      }

      this.server && await this.server.destroy();    
      this.task && await this.task.destroy();
      this.db && await this.db.destroy();
      this.logger && await this.logger.destroy();
    }

    /**
     * Get an available address
     * 
     * @async
     * @param {string|string[]} addresses
     * @returns {string}
     */
    async getAvailableAddress(addresses) {
      !Array.isArray(addresses) && (addresses = [addresses]);
      let availableAddress;

      for(let i = 0; i < addresses.length; i++) {
        const address = addresses[i];

        if(address == this.address) {
          return address;
        }
        
        try {
          await this.nodeAddressTest(address);
          return address;
        }
        catch(err) {
          this.logger.warn(err.stack);
        }
      }

      return availableAddress || null;
    }

    /**
     * Check the node address
     * 
     * @async
     */
    async nodeAddressTest(address) {
      const result = await this.requestServer(address, 'ping', {
        method: 'GET',
        timeout: this.options.request.pingTimeout
      });

      if(!result.address) {
        throw new Error(`Host ${ address } is wrong`);
      }
    }

    /**
     * Check the node is a master
     * 
     * @async
     * @returns {boolean}
     */
    async isMaster() {
      return await this.db.isMaster();
    }

    /**
     * Calculate the cpu usage
     * 
     * @async
     */
    async calculateCpuUsage() {
      this.__cpuUsage = await utils.getCpuUsage({ timeout: this.__cpuUsageInterval });
    }
    
    /**
     * Synchronize the node with the slave nodes
     * 
     * @async
     * @param {object} [options]
     */
    async syncDown(options = {}) {
      const slaves = await this.db.getSlaves();  

      if(!slaves.length) {
        return [];
      }
      
      let actualMasters = [];
      const results = await this.provideGroupStructure(slaves, { timeout: options.timeout });

      for(let i = 0; i < results.length; i++) {
        const result = results[i];
        const masters = result.masters;
        const backlink = result.backlink;
        const address = result.address;
        const slaves = result.slaves;       
        const selfMaster = masters.find(m => m.address == this.address);

        if(!selfMaster || selfMaster.size != await this.db.getSlavesCount()) {
          await this.db.addBehaviorFail('slaveMasters', address);
        }
        else {
          await this.db.subBehaviorFail('slaveMasters', address);
        }
        
        if(!backlink || backlink.address != this.address) {          
          await this.db.removeSlave(address);
          await this.db.addBehaviorFail('slaveBacklink', address);
        }
        else {
          await this.db.addSlave(address);
          await this.db.subBehaviorFail('slaveBacklink', address);
        }

        if(slaves.length) {
          masters.forEach(m => m.source = address);
          actualMasters = actualMasters.concat(masters);
        }
      }

      return actualMasters;
    }   

    /**
     * Synchronize the node with the master nodes
     * 
     * @async
     * @param {object} [options]
     */
    async syncUp(options = {}) {
      const backlink = await this.db.getBacklink();

      if(!backlink) {
        return [];
      }

      let result;
      
      try {
        result = await this.provideStructure(backlink.address, { timeout: options.timeout });
      }
      catch(err) {
        return [];
      }
      
      const slaves = result.slaves;
      const masters = result.masters;   
      
      if(!masters.find(m => m.address == backlink.address)) {
        await this.db.addBehaviorFail('backlinkMasters', backlink.address);
      }
      else {
        await this.db.subBehaviorFail('backlinkMasters', backlink.address);
      }

      if(!slaves.find(s => s.address == this.address)) {
        await this.db.getBehaviorFail('backlinkSlaves', backlink.address) && await this.db.removeBacklink();
        await this.db.addBehaviorFail('backlinkSlaves', backlink.address);
        return [];
      }
      else {
        await this.db.subBehaviorFail('backlinkSlaves', backlink.address);
      }

      await this.db.addBacklink(backlink.address);
      return masters;
    }

    /**
     * Synchronize the node with the network
     * 
     * @async
     */
    async sync() {
      const startTime = Date.now();      
      const timer = this.createRequestTimer(this.options.network.syncInterval);      
      await this.db.normalizeBanlist();
      await this.db.normalizeApproval();
      await this.db.normalizeBehaviorFails();
      await this.db.normalizeBehaviorCandidates();
      await this.db.normalizeServers();
      await this.cleanUpServers();
      await this.normalizeRoot({ timeout: timer() });
      const slaves = await this.db.getSlaves();
      const size = slaves.length;
      size? await this.db.addMaster(this.address, size): await this.db.removeMaster(this.address);      
      const mastersUp = await this.syncUp({ timeout: timer() });
      const mastersDown = await this.syncDown({ timeout: timer() });
      const actualMasters = [].concat(mastersUp, mastersDown);

      if(size) {
        const masters = await this.db.getMasters();
        masters.forEach(m => m.source = this.address);
        const structures = await this.updateMastersInfo([].concat(masters, actualMasters), { timeout: timer() });
        await this.checkStructures(structures, { timeout: timer() });
      }
      else {
        await this.db.removeMasters();

        for(let i = 0; i < actualMasters.length; i++) {
          const master = actualMasters[i];          
        
          if(!await this.isAddressAllowed(master.address)) {
            continue;
          }

          await this.db.addMaster(master.address, master.size);
        }
      }
      
      await this.normalizeMastersCount();
      await this.normalizeSlavesCount();
      
      try {
        await this.register({ timeout: timer() });
      }
      catch(err) {
        await this.db.removeBacklink();

        if(err instanceof errors.WorkError) {
          this.logger.warn(err.stack);
        }
        else {
          throw err;
        }
      }
      
      const time = Date.now() - startTime;
      this.__syncList.push({ time });
      this.__syncList.length > this.getSyncListSize() && this.__syncList.shift();
      this.logger.info(`Sync takes ${ms(time)}`);
    }

    /**
     * Check the masters structure
     * 
     * @async
     * @param {object[]} structures
     * @param {object} [options]
     */
    async checkStructures(structures, options = {}) {
      if(await this.isAddressTrusted() || !await this.isMaster()) {
        return;
      }

      const checked = await this.db.getData('checkedMasterStructures');
      const current = structures.filter(s => checked.indexOf(s.address) == -1 && s.address != this.address)[0];

      if(!current) {
        await this.db.setData('checkedMasterStructures', []);
        return;
      }

      checked.push(current.address);
      await this.checkMasterStructure(current, options);
      await this.db.setData('checkedMasterStructures', checked);
    }
  
    /**
     * Check the master structure
     * 
     * @async
     * @param {object} master
     * @param {object} [options]
     * 
     */
    async checkMasterStructure(master, options = {}) {
      await this.checkMasterStructureNetworkSize(master.address, master.masters, master.slaves); 
      await this.checkMasterStructureMasters(master.address, master.masters);
      await this.checkMasterStructureSlaves(master.address, master.slaves, options);            
    }

    /**
     * Check the master masters
     * 
     * @async
     * @param {string} address
     * @param {object[]} masters
     */
    async checkMasterStructureMasters(address, masters) {
      if(await this.isAddressTrusted(address)) {
        return;
      }

      const self = masters.find(m => m.address == this.address); 
      const size = await this.db.getSlavesCount();

      if(!masters.find(m => m.address == address) || !self || self.size != size) {
        const fn = behavior => behavior? 1 * Math.sqrt(behavior.balance): 1;
        await this.db.addBehaviorFail('masterMasters', address, fn);
      }
      else {
        const fn = behavior => behavior? 1 / Math.sqrt(behavior.balance): 1;
        await this.db.subBehaviorFail('masterMasters', address, fn);
      }
    }

    /**
     * Check the master slaves
     * 
     * @async
     * @param {string} address 
     * @param {object[]} slaves
     * @param {object} [options]
     */
    async checkMasterStructureSlaves(address, slaves, options = {}) {
      if(await this.isAddressTrusted(address)) {
        return;
      }

      const coef = await this.getNetworkOptimum();
      slaves = slaves.slice(0, coef);
      const results = await this.provideGroupStructure(slaves, { includeErrors: true, timeout: options.timeout });
      let suspicious = 0;

      for(let i = 0; i < results.length; i++) {
        const result = results[i];

        if(
          !utils.isRequestTimeoutError(result) && (
            result instanceof Error ||
            !result.backlink || 
            result.backlink.address != address
          )
        ) {
          suspicious++;
          continue;
        }
      }
      
      if(suspicious) {
        const val = suspicious / slaves.length;
        const fn = behavior => behavior? val * Math.sqrt(behavior.balance): val;
        await this.db.addBehaviorFail('masterSlaves', address, fn);
      }
      else {
        const fn = behavior => behavior? 1 / Math.sqrt(behavior.balance): 1;
        await this.db.subBehaviorFail('masterSlaves', address, fn);
      }
    }

    /**
     * Check the master network size
     * 
     * @async
     * @param {string} address 
     * @param {object[]} masters
     * @param {object[]} slaves
     */
    async checkMasterStructureNetworkSize(address, masters, slaves) {
      if(await this.isAddressTrusted(address)) {
        return;
      }
      
      const networkSize = await this.getNetworkSize(masters);
      const coef = await this.getNetworkOptimum(networkSize);
      const master = masters.find(m => m.address == address);

      if((master && master.size != slaves.length) || slaves.length > coef) {
        await this.db.addBehaviorFail('masterNetworkSize', address);
      }
      else {
        await this.db.subBehaviorFail('masterNetworkSize', address);
      }
    }

    /**
     * Register the node in the network
     * 
     * @async
     */
    async register(options = {}) {
      if(await this.db.getBacklink()) {
        return;
      }

      const timer = this.createRequestTimer(options.timeout);
      let timeout = timer();
      
      let result = await this.requestNode(this.initialNetworkAddress, 'provide-registration', {
        body: {
          target: this.address,
          timeout,
          timestamp: Date.now()
        },
        timeout,
        responseSchema: schema.getProvideRegistrationResponse()
      });
      
      const results = result.results;
      const networkSize = result.networkSize;
      const syncLifetime = result.syncLifetime;
      const coef = await this.getNetworkOptimum(networkSize);
      let freeMasters = [];
      let candidates = [];
      let failed = false;
      let winner;
     
      for(let i = results.length - 1; i >= 0; i--) {
        const res = results[i]; 
        const behavior = await this.db.getBehaviorDelay('registration', res.address);
        
        if(res.networkSize != networkSize) {
          await this.db.addBehaviorDelay('registration', res.address);
          
          if(behavior && behavior.createdAt + syncLifetime > Date.now()) {
            results.splice(i, 1);
            continue;
          }
          else {
            failed = true;
            break;
          }
        }
        else if(behavior) {
          await this.db.removeBehaviorDelay('registration', res.address);
        }
        
        if(!await this.isAddressAllowed(res.address)) {
          results.splice(i, 1);
          continue;
        }
        
        for(let k = res.candidates.length - 1; k >= 0; k--) {
          const candidate = res.candidates[k];
          
          if(candidate.address == this.address) {
            res.candidates.splice(k, 1);
            continue;
          }
          
          if(!await this.isAddressAllowed(candidate.address)) {
            res.candidates.splice(k, 1);
            continue;
          }
        }
      }

      if(failed) {
        const msg = `Network hasn't been normalized yet, try later`;
        throw new errors.WorkError(msg, 'ERR_SPREADABLE_NETWORK_NOT_NORMALIZED');
      }

      for(let i = 0; i < results.length; i++) {
        const res = results[i];
        const coef = await this.getNetworkOptimum(res.networkSize);
        candidates.push(utils.getRandomElement(res.candidates));
        res.candidates.length < coef && freeMasters.push(res);
      }
      
      if(freeMasters.length > coef) {
        freeMasters = _.orderBy(freeMasters, ['size', 'address'], ['desc', 'asc']); 
        freeMasters = freeMasters.slice(0, coef);
      }

      freeMasters = freeMasters.filter(m => m.address != this.address);
      winner = utils.getRandomElement(freeMasters.length? freeMasters: candidates);               
      
      if(!winner) {
        const msg = 'No available server to register the node';
        throw new errors.WorkError(msg, 'ERR_SPREADABLE_NETWORK_NO_AVAILABLE_MASTER');
      }

      try {
        timeout = timer();
        result = await this.requestNode(winner.address, 'register', {
          body: {
            target: this.address,
            timeout,
            timestamp: Date.now()
          },
          responseSchema: schema.getRegisterResponse(),
          timeout
        });
        this.db.subBehaviorFail('registration', winner.address);
      }
      catch(err) {
        this.db.addBehaviorFail('registration', winner.address);
        throw err;
      }
      
      await this.db.cleanBehaviorDelays('registration'); 
      await this.db.setData('registrationTime', Date.now());
      await this.db.addBacklink(winner.address);
      await this.db.addMaster(winner.address, result.size); 
    } 

    /**
     * Interview the node
     * 
     * @async
     * @returns {object}
     */
    async interview(summary) {
      if(!summary || typeof summary != 'object') {
        const msg = 'Not found the interview summary';
        throw new errors.WorkError(msg, 'ERR_SPREADABLE_INTERVIEW_NOT_FOUND_SUMMARY');
      }

      if(!utils.isValidHostname(utils.splitAddress(summary.address)[0])) {
        const msg = 'Invalid interview summary address';
        throw new errors.WorkError(msg, 'ERR_SPREADABLE_INTERVIEW_INVALID_SUMMARY_ADDRESS');
      }
    }

    /**
     * Get the interview summary
     * 
     * @async
     * @returns {object}
     */
    async getInterviewSummary() {
      return {
        address: this.address
      };
    }
    
    /**
     * Get the node status info
     * 
     * @async
     * @param {boolean} [pretty=false]
     * @returns {object}
     */
    async getStatusInfo(pretty = false) {
      const availability = await this.getAvailability();
      const syncAvgTime = this.getSyncAvgTime();
      
      return {     
        root: this.getRoot(),   
        availability: pretty? availability.toFixed(2): availability,
        syncAvgTime: pretty? ms(syncAvgTime): syncAvgTime,
        isMaster: await this.isMaster(),
        isNormalized: await this.isNormalized(),
        isRegistered: await this.isRegistered(),
        networkSize: await this.getNetworkSize()
      }
    }

    /**
     * Get the sync lifetime
     * 
     * @async
     * @returns {number}
     */
    async getSyncLifetime() {
      const delay = this.options.network.syncInterval;
      return delay * this.options.network.serverMaxFails * await this.getNetworkOptimum();
    }

    /**
     * Check the node is normalized
     * 
     * @async
     * @returns {boolean}
     */
    async isNormalized() {
      return Date.now() - await this.getSyncLifetime() > this.__initialized;
    }

    /**
     * Check the node is registered
     * 
     * @async
     * @returns {boolean}
     */
    async isRegistered() {
      return !!(await this.db.getBacklink());
    }

    /**
     * Update the node masters info
     * 
     * @async
     * @param {object[]} masters
     * @param {object} [options]
     */
    async updateMastersInfo(masters, options = {}) {    
      const obj = {};
      const structures = [];
      
      for(let i = 0; i < masters.length; i++) {        
        const master = masters[i]; 

        if(master.address == this.address) {
          continue;
        }
        
        if(!await this.isAddressAllowed(master.address)) {
          continue;
        }
        
        obj[master.address] = { master };
      }

      const arr = [];

      for(let key in obj) {
        const item = obj[key];
        arr.push({ address: item.master.address });
      }

      const results = await this.provideGroupStructure(arr, { includeErrors: true, timeout: options.timeout });

      for(let i = results.length - 1; i >= 0; i--) {
        const result = results[i];
        const address = result.address;
        let size = 0;

        if(!(result instanceof Error)) {
          size = result.slaves.length;
          size && structures.push(result);
        }
        
        if(!size) {
          await this.db.removeMaster(address);
          continue;
        }

        await this.db.addMaster(address, size);
      }

      return structures;
    }

    /**
     * Clean up the node servers
     * 
     * @async
     */
    async cleanUpServers() {
      const lifetime = await this.getSyncLifetime();
      const servers = await this.db.getServers();

      if(Date.now() - lifetime < this.__initialized) {
        return;
      }

      for(let i = servers.length - 1; i >= 0; i--) {
        const server = servers[i];

        if(await this.db.getBanlistAddress(server.address)) {
          continue;
        }

        if(server.isBroken) {
          server.updatedAt < Date.now() - lifetime && await this.db.removeServer(server.address); 
          continue;
        }

        if(server.isMaster) {          
          server.updatedAt < Date.now() - lifetime && await this.db.removeMaster(server.address); 
          continue;
        }
        
        if(server.isMaster && server.address == this.address && !await this.isMaster()) {
          await this.db.removeMaster(server.address);
        }
      }
    }

    /**
     * Normalize the node masters count
     * 
     * @async
     */
    async normalizeMastersCount() {
      if(!await this.isMaster()) {
        return;
      }
      
      let masters = await this.db.getMasters();
      const size = await this.getNetworkOptimum();
      
      if(masters.length > size) {
        masters = _.orderBy(masters, ['size', 'address'], ['desc', 'asc']);
        masters = masters.slice(0, size).map(m => m.address);
        masters.indexOf(this.address) == -1 && await this.db.removeSlaves();
      }
    }

    /**
     * Normalize the node slaves count
     * 
     * @async
     */
    async normalizeSlavesCount() {
      let count = await this.db.getSlavesCount();
      const size = await this.getNetworkOptimum();
      
      if(count > size) {
        await this.db.shiftSlaves(count - size);
      }
    }
    
    /**
     * Normalize the root
     * 
     * @async
     * @param {object} [options]
     */
    async normalizeRoot(options = {}) {  
      const timer = this.createRequestTimer(options.timeout);
      const time = await this.getSyncLifetime();
      const now = Date.now();
      
      if(this.__rootNetworkAddress && this.__rootCheckedAt && now - time <= this.__rootCheckedAt) {        
        return;
      }

      let newRoot;

      if(this.address == this.initialNetworkAddress) {
        newRoot = this.address; 
      }
      else {
        const timeout = timer(this.options.request.pingTimeout);
        const result = await this.requestServer(this.initialNetworkAddress, 'status', { method: 'GET', timeout });  
        newRoot = result.root;
        !result.isRegistered && await this.db.removeBacklink();
      }

      await this.db.setData('rootNetworkAddress', newRoot);
      this.__rootNetworkAddress = newRoot;
      this.__rootCheckedAt = Date.now();
    }

    /**
     * Get the random node address from the network
     * 
     * @async
     * @param {object} [options]
     * @returns {string} 
     */
    async getAvailableNode(options = {}) { 
      const timer = this.createRequestTimer(options.timeout);
      const masters = await this.db.getMasters();
      const master = utils.getRandomElement(masters);

      if(!master) {
        return this.address;
      }

      const result = await this.provideStructure(master.address, { timeout: timer() });
      const server = utils.getRandomElement(result.slaves);

      if(!server) {
        return this.address;
      }

      try {
        await this.requestServer(server.address, 'ping', { method: 'GET', timeout: timer() });
        return server.address;
      }
      catch(err) {
        this.logger.warn(err.stack);
        return this.address;
      }
    }
    
    /**
     * Prepare candidates suspicion info
     * 
     * @async
     * @param {string} action
     * @returns {object}
     */
    async prepareCandidateSuscpicionInfo(action) {
      const obj = {};
      const arr = await this.db.getBehaviorCandidates(action);      
      arr.forEach(candidate => {
        let level = candidate.suspicion - candidate.excuse;
        obj[candidate.address] = level < 0? 0: level;
      });
      return obj; 
    }

    /**
     * Create a suspicion comparison function
     * 
     * @async
     * @param {function} fn 
     * @returns {function}
     */
    async createSuspicionComparisonFunction(action, fn) {
      const obj = await this.prepareCandidateSuscpicionInfo(action);

      return (a, b) => {
        const suspicionLevelA = obj[a.address] || 0;
        const suspicionLevelB = obj[b.address] || 0;

        if(fn && suspicionLevelA == suspicionLevelB) {
          return fn(a, b);
        }
        
        return suspicionLevelA - suspicionLevelB;
      }
    }

    /**
     * Create a suspicion comparison function
     * 
     * @async
     * @param {function} [fn] 
     * @returns {function}
     */
    async createSuscpicionComparisonFunction(action, fn) {
      const obj = await this.prepareCandidateSuscpicionInfo(action);

      return (a, b) => {
        const suspicionLevelA = obj[a.address] || 0;
        const suspicionLevelB = obj[b.address] || 0;

        if(fn && suspicionLevelA == suspicionLevelB) {
          return fn(a, b);
        }
        
        return suspicionLevelA - suspicionLevelB;
      }
    }

     /**
     * Create an address comparison function
     * 
     * @async
     * @param {function} [fn] 
     * @returns {function}
     */
    async createAddressComparisonFunction(fn) {
      return (a, b) => {
        if(a == this.address && b != this.address) {
          return -1;
        }

        if(b == this.address && a != this.address) {
          return 1;
        }

        return fn? fn(a, b): 0;
      }
    }

    /**
     * Check the address is allowed
     * 
     * @async
     */
    async isAddressAllowed() {
      try {
        await this.addressFilter(...arguments);
        return true;
      }
      catch(err) {
        if(err instanceof errors.AccessError) {
          return false;
        }

        throw err;
      }
    }

    /**
     * Check the address is trusted
     * 
     * @async
     * @params {string} [address]
     * @returns {boolean}
     */
    async isAddressTrusted(address) {
      if(this.options.network.isTrusted) {
        return true;
      }

      if(!address) {
        return false;
      }

      if(address == this.address) {
        return true;
      }
     
      try {
        const info = await this.getAddressInfo(address);
        const trust = this.options.network.trustlist || [];
        if(trust.length) {
          
          for(let i = 0; i < trust.length; i++) {
            if(await this.compareAddressInfo(trust[i], info)) {
              return true;
            }
          }
        }
      }
      catch(err) {
        return false;
      }

      return false;
    }

    /**
     * Get the address info
     * 
     * @async
     * @param {string} address
     * @returns {object}
     */
    async getAddressInfo(address) {
      if(!utils.isValidAddress(address)) {
        throw new Error(`Address "${address}" is invalid`);
      }

      const hostname = utils.splitAddress(address)[0];
      let ip;

      try {
        ip = await utils.getHostIp(hostname);
      }
      catch(err) {
        throw new Error(`Hostname "${hostname}" is invalid`);
      }  
      
      if(!ip) {
        throw new Error(`Ip address for "${hostname}" is invalid`);
      }
      
      const ipv6 = utils.isIpv6(ip)? utils.getFullIpv6(ip): utils.ipv4Tov6(ip);
      return { address, ip, ipv6, hostname };
    }

    /**
     * Compare the address info 
     * 
     * @async
     * @param {string} item
     * @returns {boolean}
     */
    async compareAddressInfo(item, info) {
      if(utils.isIpv6(item)) {
        item = utils.getFullIpv6(item);
      }

      return (
        item == info.address || 
        item == info.hostname || 
        item == info.ip || 
        item == info.ipv6
      );
    }

    /**
     * Filter the address
     * 
     * @param {string} address 
     */
    async addressFilter(address) {
      if(address == this.address) {
        return;
      }

      if(await this.isAddressTrusted(address)) {
        return;
      }

      let info;

      try {
        info = await this.getAddressInfo(address);
      }
      catch(err)  {
        throw new errors.AccessError(err.message);
      }

      const white = this.options.network.whitelist || [];
      const black = this.options.network.blacklist || [];

      if(await this.db.checkBanlistIp(info.ipv6)) {
        throw new errors.AccessError(`Ip "${info.ip}" is in the banlist`);
      }

      if(white.length) {
        let exists = false;
        
        for(let i = 0; i < white.length; i++) {
          if(await this.compareAddressInfo(white[i], info)) {
            exists = true;
            break;
          }
        }

        if(!exists) {
          throw new errors.AccessError(`Address "${address}" is denied`);
        }
        
        return;
      }

      for(let i = 0; i < black.length; i++) {
        if(await this.compareAddressInfo(black[i], info)) {
          throw new errors.AccessError(`Address "${address}" is in the blacklist`);
        }
      }
    }

    /**
     * Get the provider
     * 
     * @async
     * @returns {string}
     */
    async getProvider() {
      const providers = (await this.db.getMasters()).filter(m => !m.fails && m.address != this.address).map(m => m.address);
      providers.indexOf(this.initialNetworkAddress) == -1 && providers.push(this.initialNetworkAddress);
      const syncTime = await this.getSyncLifetime();
      const delay = this.options.network.syncInterval;
      const chance = 1 / (syncTime / delay / (this.options.behavior.failSuspicionLevel + 1));
      return providers.length && Math.random() <= chance? utils.getRandomElement(providers): this.address;
    }

    /**
     * Provide the node structure
     * 
     * @async
     * @param {string} target
     * @param {object} [options]
     * @returns {object}
     */
    async provideStructure(target, options = {}) {
      const provider = options.provider || await this.getProvider();
      const timer = this.createRequestTimer(options.timeout);
      
      try {
        const timeout = this.options.request.pingTimeout + await this.getRequestServerTimeout();
        return await this.requestNode(target, 'structure', {
          responseSchema: schema.getStructureResponse(),
          timeout: timer(timeout),
          provider
        });
      }
      catch(err) {
        this.logger.warn(err.stack);

        if(provider != this.address && err.provider && err.response && !err.response.headers.get('provider-target')) {
          return await this.provideStructure(target, { provider: this.address, timeout: timer() });
        }

        throw err;
      }
    }

    /**
     * Provide the node group structure 
     * 
     * @async
     * @param {array} targets
     * @returns {object[]}
     */
    async provideGroupStructure(targets, options = {}) {
      if(!targets.length) {
        return [];
      }

      const provider = options.provider || await this.getProvider();
      const timer = this.createRequestTimer(options.timeout);      

      try {
        provider != this.address && await this.nodeAddressTest(provider);
        const timeout = this.options.request.pingTimeout + await this.getRequestServerTimeout();        
        return await this.requestGroup(targets, 'structure', {
          responseSchema: schema.getStructureResponse(),
          timeout: timer(timeout),
          includeErrors: options.includeErrors,
          provider
        });
      }
      catch(err) {
        this.logger.warn(err.stack);

        if(provider != this.address) {
          return await this.provideGroupStructure(targets, { provider: this.address, timeout: timer() });
        }

        throw err;
      }
    }

    /**
     * Make a request
     * 
     * @async
     * @param {string} url - url without a protocol
     * @param {object} [options]
     * @param {object} [options.url] - with a protocol
     * @returns {object}
     */
    async request(url, options = {}) { 
      options = _.merge({}, options);

      if(typeof url == 'object') {
        options = url;
      } 
      else {
        options.url = `${this.getRequestProtocol()}://${url}`;
      }
      
      let provider = options.provider === true? await this.getProvider(): options.provider;
      (provider == this.address) && (provider = null);
      options = this.createDefaultRequestOptions(options);
      const urlInfo = urlib.parse(options.url);
      const address = `${urlInfo.hostname}:${urlInfo.port}`;
      await this.addressFilter(address);

      if(provider) {
        options.headers['original-address'] = provider;
        options.timeout && (options.headers['provider-timeout'] = options.timeout);
        options.headers['provider-timestamp'] = Date.now();
        options.headers['provider-url'] = options.url;
        options.url = `${this.getRequestProtocol()}://${ provider }/provide-request`;
      }
      
      let body = options.formData || options.body || {};

      if(options.formData) {
        const form = new FormData();

        for(let key in body) {
          let val = body[key];

          if(typeof val == 'object') {
            form.append(key, val.value, val.options);
          }
          else {
            form.append(key, val);
          }
        }

        options.body = form;
        delete options.formData;
      }
      else if(_.isPlainObject(body)) {
        options.headers['content-type'] = 'application/json';
        options.body = Object.keys(body).length? JSON.stringify(body): undefined;
      }
      
      const start = Date.now();  
      let response = {};

      try {
        response = await fetch(options.url, options);
        this.logger.info(`Request from "${this.address}" to "${options.url}": ${ms(Date.now() - start)}`);

        if(response.ok) {
          response.provider = provider;
          return options.getFullResponse? response: await response.json();
        }

        const type = (response.headers.get('content-type') || '').match('application/json')? 'json': 'text';
        const body = await response[type]();
       
        if(!body || typeof body != 'object') {
          throw new Error(body || 'Unknown error');
        }

        if(!body.code) {
          throw new Error(body.message || body);
        }
        
        throw new errors.WorkError(body.message, body.code);
      }
      catch(err) {
        //eslint-disable-next-line no-ex-assign
        utils.isRequestTimeoutError(err) && (err = utils.createRequestTimeoutError());
        provider && (err.provider = provider);
        err.response = response;
        err.requestOptions = options;
        throw err;
      }
    }

    /**
     * Request to the network
     * 
     * @async
     * @param {string} action
     * @param {object} [options]
     * @param {number} [options.level]
     * @param {number} [options.timeout] 
     * @param {object} [options.body]
     * @returns {array}
     */
    async requestNetwork(action, options = {}) {
      const level = options.level === undefined? 1: options.level;
      const timeout = options.timeout || await this.getRequestMasterTimeout();
      const requests = [];

      if(timeout <= 0) {
        return requests;
      }

      const body = options.body || {};
      const actionType = level > 1? 'master': (level? 'butler': 'slave');
      let servers = level? await this.db.getMasters(): await this.db.getSlaves();
      !servers.length && (servers = [{ address: this.address }]);
      
      for(let i = 0; i < servers.length; i++) {
        const address = servers[i].address;
        requests.push(new Promise(resolve => {
          this.requestServer(address, `/api/${ actionType }/${ action }`, Object.assign({}, options, {
            body: Object.assign({}, body, {
              level,
              timeout, 
              timestamp: Date.now()
            }),
            timeout
          }))
          .then(resolve)
          .catch(resolve)
        }));
      }          
      
      let results = await Promise.all(requests);
      !options.includeErrors && (results = results.filter(r => !(r instanceof Error)));      
      return results;
    }

    /**
     * Request to the node
     * 
     * @async
     * @param {string} address
     * @param {string} action
     * @param {object} [options]
     * @returns {object}
     */
    async requestNode(address, action, options = {}) {
      return await this.requestServer(address, `/api/node/${action}`, options);
    }

    /**
     * Group request to the node
     * 
     * @async
     * @param {aray} arr 
     * @param {string} url
     * @param {object} [options]
     * @returns {object}
     */
    async requestGroup(arr, url, options = {}) {
      const requests = [];
      const timer = this.createRequestTimer(options.timeout);

      for(let i = 0; i < arr.length; i++) {
        const item = arr[i];

        requests.push(new Promise(resolve => {
          const opts = _.merge({ requestType: 'node' }, options, item.options);
          opts.timeout = timer(opts.timeout);
          const requestType = _.capitalize(opts.requestType);
          const p = requestType? this[`request${ requestType }`](item.address, url, opts): this.request(url, opts);
          p.then(resolve).catch(resolve);
        }));
      }

      let results = await Promise.all(requests);
      !options.includeErrors && (results = results.filter(r => !(r instanceof Error)));     
      return results;
    }

    /**
     * Request to the server
     * 
     * @async
     * @param {string} address
     * @param {string} [url]
     * @param {object} [options]
     * @returns {object}
     */
    async requestServer(address, url, options = {}) {
      options = _.merge({}, options);
      const timeout = options.timeout || await this.getRequestServerTimeout();
      options.timeout = timeout;

      try {
        const opts = Object.assign({}, options, { getFullResponse: true });
        let result = await this.request(`${address}/${url}`.replace(/[/]+/, '/'), opts);
        await this.db.subBehaviorFail('requestDelays', address);
        result.provider && await this.db.subBehaviorFail('requestDelays', result.provider);
        let body = await result.json();      
        
        if(options.getFullResponse) {          
          result.__json = body;
        }
        else {
          result = body;
        }

        if(body && typeof body == 'object' && !Array.isArray(body)) {
          body.address = address;
        }

        if(options.responseSchema) {
          try {
            utils.validateSchema(options.responseSchema, body);
            await this.db.subBehaviorFail('responseSchema', address);
          }
          catch(err) {
            await this.db.addBehaviorFail('responseSchema', address);
            err.code = 'ERR_SPREADABLE_RESPONSE_SCHEMA';
            throw err;
          }
        }
        
        result.provider && this.db.successServerAddress(result.provider);
        await this.db.successServerAddress(address);
        return result;
      }
      catch(err) {
        this.logger.warn(err.stack);

        if(err.provider && err.response && !err.response.headers.get('provider-target')) {
          address = err.provider;
        }

        if(utils.isRequestTimeoutError(err)) {
          await this.db.addBehaviorFail('requestDelays', address);
        }

        if(err instanceof errors.WorkError) {
          await this.db.successServerAddress(address);
        }
        else {
          await this.db.failedServerAddress(address);
        }

        throw err;
      }
    }

    /**
     * Duplicate data to the servers
     * 
     * @async
     * @param {string} action 
     * @param {string[]} servers
     * @param {object} [options]
     * @param {object|function} [options.serverOptions]
     * @param {object} [options.formData]
     * @param {object} [options.body]
     * @returns {object}
     */
    async duplicateData(action, servers, options = {}) {
      options = _.merge({}, options);
      const timer = this.createRequestTimer(options.timeout);      
      let result;
      
      while(servers.length) {
        const address = servers[0];
        let serverOptions = typeof options.serverOptions == 'function'? options.serverOptions(address): options.serverOptions;
        serverOptions = _.merge({}, options, serverOptions || {});

        if(serverOptions.formData) {
          servers.slice(1).forEach((val, i) => serverOptions.formData[`duplicates[${i}]`] = val);
        }
        else {
          serverOptions.body.duplicates = servers.slice(1);
        }         
        
        try {
          serverOptions.timeout = timer(serverOptions.timeout);
          result = await this.requestNode(address, action, serverOptions);
          return result;
        }
        catch(err) {
          if(err instanceof errors.WorkError) {
            throw err;
          }

          servers.shift();
          this.logger.warn(err.stack);
        }
      }
    }

    /**
     * Check the request client access
     * 
     * @async
     * @param {http.ClientRequest} req
     */
    async networkAccess() {}

    /**
     * Get the node availability
     * 
     * @async
     * @returns {float} 0-1
     */
    async getAvailability() {
      const arr = await this.getAvailabilityParts();
      return arr.reduce((p, c) => p + c, 0) / arr.length;
    }

    /**
     * Get the node availability parts
     * 
     * @async
     * @returns {float[]} 0-1
     */
    async getAvailabilityParts() {
      return [
        await this.getAvailabilityMemory(),
        await this.getAvailabilityCpu()
      ]
    }

    /**
     * Get the node process memory availability
     * 
     * @async
     * @returns {float} 0-1
     */
    async getAvailabilityMemory() {
      const stats = v8.getHeapStatistics();
      return 1 - stats.used_heap_size / stats.total_available_size;
    }

    /**
     * Get the system cpu availability
     * 
     * @async
     * @returns {float} 0-1
     */
    async getAvailabilityCpu() {
      return 1 - this.__cpuUsage / 100;
    }

    /**
     * Get the request server timeout
     * 
     * @returns {integer}
     */
    async getRequestServerTimeout() {
      return this.options.request.serverTimeout;
    }

    /**
     * Get the request master timeout
     * 
     * @returns {integer}
     */
    async getRequestMasterTimeout() {    
      const serverTimeout = await this.getRequestServerTimeout(); 
      return serverTimeout * (await this.getNetworkDepth() + 1);
    }

    /**
     * Get the network depth
     * 
     * @async
     * @returns {integer}
     */
    async getNetworkDepth() {
      return 1;
    }

    /**
     * Get the network size
     * 
     * @async
     * @param {object[]} [list]
     * @returns {integer}
     */
    async getNetworkSize(list) {
      !list && (list = await this.db.getMasters());
      return list.reduce((v, obj) => v + obj.size, 0) || 1;
    }

    /**
     * Get the value given the network size
     * 
     * @async
     * @param {object} value 
     * @returns {number}
     */
    async getValueGivenNetworkSize(value) {
      const networkSize = await this.getNetworkSize();

      if(value == 'auto') {
        value = Math.ceil(Math.sqrt(networkSize));
      }
      else if(typeof value == 'string') {
        value = Math.ceil(networkSize * parseFloat(value) / 100); 
      }

      value > networkSize && (value = networkSize);
      value <= 0 && (value = 1);
      return value;
    }

    /**
     * Get the network size
     * 
     * @async
     * @param {integer} [size]
     * @returns {integer}
     */
    async getNetworkOptimum(size) {
      return Math.floor(Math.sqrt(size || await this.getNetworkSize())) + 1; 
    }

    /**
     * Get the candidate suspicion level
     * 
     * @async
     * @returns {integer}
     */
    async getCandidateSuspicionLevel() {
      const max = await this.getCandidateMaxSuspicionLevel();      
      const level = this.options.behavior.candidateSuspicionLevel;
      return max > level? level: max;
    }

    /**
     * Get the candidate excuse level
     * 
     * @async
     * @returns {integer}
     */
    async getCandidateExcuseStep() {
      const level = await this.getCandidateSuspicionLevel();
      return (1 / level) * Math.sqrt(level);
    }

    /**
     * Get the candidate max suspicion level
     * 
     * @async
     * @returns {integer}
     */
    async getCandidateMaxSuspicionLevel() {
      return Math.cbrt(Math.pow(await this.getNetworkSize() - 1, 2));
    }

    /**
     * Filter the candidates matrix
     * 
     * @param {array[]} arr
     * @see Node.prototype.filterCandidates
     */
    async filterCandidatesMatrix(matrix, options = {}) {
      let candidates = [];

      for(let i = 0; i < matrix.length; i++) {
        candidates = await this.filterCandidates(candidates.concat(matrix[i]), options);
      }

      return candidates;
    }

    /**
     * Filter the candidates array
     * 
     * @param {array} arr 
     * @param {object} [options]
     * @param {boolean|string} [options.uniq]
     * @param {integer} [options.limit]
     * @param {object} [options.schema]
     * @param {function} [options.fnFilter]
     * @param {function} [options.fnCompare] 
     * @returns {object[]}
     */
    async filterCandidates(arr, options = {}) {
      arr = arr.slice();

      if(options.uniq) {
        arr = options.uniq === true? _.uniq(arr): _.uniqBy(arr, options.uniq);
      }

      if(options.fnFilter) {
        arr = arr.filter(options.fnFilter);
      }
      
      for(let i = arr.length - 1; i >= 0; i--) {
        if(!await this.isAddressAllowed(arr[i].address)) {
          arr.splice(i, 1);
        }
      }

      if(options.schema) {
        arr = arr.filter(item => {
          try {
            utils.validateSchema(options.schema, item)
            return true;
          }
          catch(err) {
            return false;
          }
        });
      }  
      
      options.fnCompare && arr.sort(options.fnCompare);      
      options.limit && (arr = arr.slice(0, options.limit));
      return arr;
    }

    /**
     * Get the masters status lifetime
     * 
     * @async
     * @returns {integer}
     */
    async getMasterStatusLifetime() {
      return (await this.getSyncLifetime()) / (this.options.behavior.failSuspicionLevel + 1);
    }

    /**
     * Get the fail lifetime
     * 
     * @async
     * @returns {integer}
     */
    async getFailLifetime() {
      return await this.getSyncLifetime();
    }

    /**
     * Add the behavior
     * 
     * @async
     * @param {string} action
     * @param {Behavior} behavior
     * @returns {object}
     */
    async addBehavior(action, behavior) {
      this.__behavior[action] = behavior;
      this.__initialized && !behavior.__initialized && await behavior.init();
      return behavior;
    }
    
    /**
     * Get the behavior
     * 
     * @async
     * @param {string} action
     * @returns {object}
     */
    async getBehavior(action) {
      return this.__behavior[action] || null;
    }

    /**
     * Remove the behavior
     * 
     * @async
     * @param {string} action
     */
    async removeBehavior(action) {
      const behavior = this.__behavior[action];

      if(!behavior) {
        return;
      }

      await behavior.destroy();
      delete this.__behavior[action];
    }

    /**
     * Add the approval
     *
     * @async
     * @param {string} action
     * @param {Approval} approval
     * @returns {object}
     */
    async addApproval(action, approval) {
      this.__approval[action] = approval;
      this.__initialized && !approval.__initialized && await approval.init();
      return approval;
    }

    /**
     * Get the approval options
     * 
     * @async
     * @param {string} action
     * @returns {object}
     */
    async getApproval(action) {
      return this.__approval[action] || null;
    }

    /**
     * Remove the approval options
     * 
     * @async
     * @param {string} action
     */
    async removeApproval(action) {
      const approval = this.__approval[action];

      if(!approval) {
        return;
      }

      await approval.destroy();
      delete this.__approval[action];
    }

    /**
     * Test the approval action
     * 
     * @async
     * @param {string} action
     */
    async approvalActionTest(action) {
      if(!await this.getApproval(action)) {
        const msg = `invalid approval action "${ action }"`;
        throw new errors.WorkError(msg, 'ERR_SPREADABLE_INVALID_APPROVAL_ACTION');
      }      
    }

    /**
     * Request the approval key
     * 
     * @async
     * @param {string} action 
     * @param {string} clientIp
     * @param {object} [options]
     * @returns {object}
     */
    async requestApprovalKey(action, clientIp, options = {}) {    
      await this.approvalActionTest(action);
      const approval = await this.getApproval(action);  
      const time = utils.getClosestPeriodTime(Date.now(), approval.period);
      const approversCount = await approval.calculateApproversCount();
      let approvers = await this.getApprovalApprovers(time, approversCount, options);        
      const key = utils.createDataHash([clientIp, action, time, this.address, ...approvers]);
      return { approvers, key, startedAt: time, clientIp };
    }

    /**
     * Request the approval question
     * 
     * @async
     * @param {string} action 
     * @param {string} clientIp
     * @param {string} key
     * @param {*} [info]
     * @param {string[]} [confirmedAddresses]
     * @param {object} [options]
     * @returns {object}
     */
    async requestApprovalQuestion(action, clientIp, key, info, confirmedAddresses = [], options = {}) {
      const timer = this.createRequestTimer(options.timeout);
      await this.approvalActionTest(action);
      const approval = await this.getApproval(action);   
      approval.clientInfoTest(info);
      const approversCount = await approval.calculateApproversCount();    
      let approvers = confirmedAddresses.slice(0, approversCount);
      await approval.approversDecisionCountTest(approvers.length);
      const targets = approvers.map(address => ({ address }));
      const results = await this.requestGroup(targets, 'get-approval-info', Object.assign({}, options, {
        includeErrors: false,        
        timeout: timer(await this.getRequestServerTimeout()),
        responseSchema: schema.getApprovalApproverInfoResponse(approval.getApproverInfoSchema()),
        body: {
          action,
          key
        }
      }));
      approvers = results.map(r => r.address);
      await approval.approversDecisionCountTest(approvers.length);
      const question = await approval.createQuestion(results.map(r => r.info), info, clientIp);
      return question;
    }

    /**
     * Request the approval question
     * 
     * @async
     * @param {string} action 
     * @param {string} clientIp
     * @param {string} key
     * @param {integer} startedAt
     * @param {object} [info]
     */
    async addApprovalInfo(action, clientIp, key, startedAt, info) {
      await this.approvalActionTest(action);
      const approval = await this.getApproval(action);
      await approval.startTimeTest(startedAt);
      approval.clientInfoTest(info);
      await this.db.addApproval(action, clientIp, key, startedAt, info);
    }

    /**
     * Get the approval approvers
     * 
     * @async
     * @param {number} time 
     * @param {number} totalCount
     * @param {object} [options]
     * @returns {string[]}
     */
    async getApprovalApprovers(time, totalCount, options = {}) {
      let approvers = [];
      const timer = this.createRequestTimer(options.timeout);
      const masters = await this.db.getMasters();

      if(!masters.length) {
        return [this.address];
      }

      const results = await this.provideGroupStructure(masters, { timeout: timer() });

      for(let i = 0; i < results.length; i++) {
        const slaves = results[i].slaves;

        for(let k = 0; k < slaves.length; k++) {
          const server = slaves[k];  
          const address = server.address;
          approvers.push({ address, hash: utils.createDataHash([address, String(time)]) });
        }
      }

      approvers = approvers.sort((a, b) => {
        return a.hash > b.hash? 1: (a.hash < b.hash? -1: 0);
      }).map(it => it.address);

      const additional = Math.ceil(Math.sqrt(totalCount));
      let total = [];
      let targets = [];

      for(let i = 0; i < approvers.length; i++) {
        const count = totalCount - total.length + additional;
        targets.push({ address: approvers[i] });

        if(targets.length % count != 0 && i + 1 < approvers.length) {
          continue;
        }

        const timeout = timer(this.options.request.pingTimeout);
        const opts = { method: 'GET', timeout, requestType: 'server', includeErrors: true };
        const results = await this.requestGroup(targets, 'ping', opts);
        
        for(let k = 0; k < results.length; k++) {
          const result = results[k];

          if(result && typeof result == 'object' && result.address != targets[k].address) {
            targets[k] = null;
          }
        }

        total = total.concat(targets.filter(t => t).map(t => t.address));
        targets = [];

        if(total.length >= totalCount) {
          break;
        }
      }

      return total.slice(0, totalCount);
    }

    /**
     * Get the node structure
     * 
     * @async
     * @returns {object}
     */
    async createStructure() {
      const address = this.address;
      let backlink = await this.db.getBacklink();
      backlink && (backlink = _.pick(backlink, ['address', 'hash']));
      const masters = (await this.db.getMasters()).map(m => _.pick(m, ['address', 'size']));      
      const slaves = (await this.db.getSlaves()).map(s => _.pick(s, ['address']));
      return { address, backlink, slaves, masters };
    }
    
    /**
     * Create default request options
     * 
     * @param {object} options
     * @returns {object}
     */
    createDefaultRequestOptions(options = {}) {
      const defaults = {
        method: 'POST',
        headers: {          
          'original-address': this.address,
          'node-version': this.getVersion(),
          'node-root': this.getRoot()
        }
      };

      if(this.options.network.auth) {
        const user = this.options.network.auth.username;
        const pass = this.options.network.auth.password;
        defaults.headers.authorization = `Basic ${ Buffer.from(user + ":" + pass).toString('base64') }`;
      }

      if(!options.agent) {
        options.agent = new (this.options.server.https? https: http).Agent();
      }

      options.agent.maxSockets = Infinity;

      if(options.timeout) {
        options.timeout = utils.getMs(options.timeout);
      }

      if(typeof this.options.server.https == 'object' && this.options.server.https.ca) {
        options.agent.options.ca = this.options.server.https.ca;
      }

      return _.merge(defaults, options);
    }

    /**
     * Create the request network options
     * 
     * @param {object} body 
     * @param {object} [options]
     * @returns {object}
     */
    createRequestNetworkOptions(body, options = {}) {
      return _.merge({
        body,
        timeout: this.createRequestTimeout(body),
        level: body.level === undefined? body.level: body.level - 1
      }, options);
    }

    /**
     * Prepare the client message options
     * 
     * @param {object} body 
     * @param {object} [options]
     * @returns {object}
     */
    prepareClientMessageOptions(body, options = {}) {
      options = _.merge({
        timeout: this.createRequestTimeout(body),
        approvalInfo: body.approvalInfo
      }, options);

      if(body.approvalInfo && typeof body.approvalInfo == 'string') {
        options.approvalInfo = JSON.parse(body.approvalInfo)
      }

      return options;
    }

    /**
     * Create a request timeout
     * 
     * @param {object} data 
     * @param {number} data.timeout 
     * @param {number} data.timestamp
     */
    createRequestTimeout(data) {
      if(!data || typeof data != 'object' || !data.timeout) {
        return;
      }

      return (data.timeout - (Date.now() - data.timestamp)) - this.__timeoutSlippage;
    }    

    /**
     * Create a request timer
     * 
     * @param {number} timeout 
     * @returns {function}
     */
    createRequestTimer(timeout, options = {}) {
      options = Object.assign({
        min: this.options.request.pingTimeout
      }, options);
      return utils.getRequestTimer(timeout, options);
    }

    /**
     * Get the request protocol
     * 
     * @returns {string}
     */
    getRequestProtocol() {
      return this.options.server.https? 'https': 'http';
    }

    /**
     * Get the sync list size
     * 
     * @returns {number}
     */
    getSyncListSize() {
      return Math.floor(this.options.network.syncTimeCalculationPeriod / this.options.network.syncInterval);
    }

    /**
     * Get the sync average time
     * 
     * @returns {number}
     */
    getSyncAvgTime() {
      if(!this.__syncList.length) {
        return 0;
      }
      
      return this.__syncList.reduce((p, c) => c.time + p, 0) / this.__syncList.length;
    }
    
    /**
     * Prepare the options
     */
    prepareOptions() {      
      this.options.request.serverTimeout = utils.getMs(this.options.request.serverTimeout);
      this.options.request.pingTimeout = utils.getMs(this.options.request.pingTimeout);
      this.options.network.syncInterval = utils.getMs(this.options.network.syncInterval);
      this.options.network.syncTimeCalculationPeriod = utils.getMs(this.options.network.syncTimeCalculationPeriod);
      this.options.network.authCookieMaxAge = utils.getMs(this.options.network.authCookieMaxAge);
    } 

    /**
     * Get the node version
     * 
     * @returns {string}
     */
    getVersion() {
      return `${ this.constructor.codename }-${ this.constructor.version.split('.').slice(0, -1).join('.') }`;
    }

    /**
     * Get the node root address
     * 
     * @returns {string}
     */
    getRoot() {
      return this.__rootNetworkAddress;
    }
  }
};
