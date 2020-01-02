const ms = require('ms');
const os = require('os');
const v8 = require('v8');
const urlib = require('url');
const _ = require('lodash');
const https = require('https');
const fetch = require('node-fetch');
const FormData = require('form-data');
const externalIp = require('external-ip');
const DatabaseLoki = require('./db/transports/loki')();
const ServerExpress = require('./server/transports/express')();
const LoggerConsole = require('./logger/transports/console')();
const TaskInterval = require('./task/transports/interval')();
const Service = require('./service')();
const utils = require('./utils');
const schema = require('./schema');
const errors = require('./errors');
const pack = require('../package');

module.exports = (Parent) => { 
  /**
   * The node class
   */
  return class Node extends (Parent || Service) {
    static get codename () { return 'spreadable' }
    static get DatabaseTransport () { return DatabaseLoki }
    static get ServerTransport () { return ServerExpress }
    static get LoggerTransport () { return LoggerConsole }
    static get TaskTransport () { return TaskInterval }

    /**
     * @param {object} options
     * @param {object} options.port
     * @param {object} options.initialNetworkAddress
     */
    constructor(options = {}) {
      super(...arguments);

      if(!options.port) {
        throw new Error('You must pass the necessary port');
      }

      if(!options.initialNetworkAddress) {
        throw new Error(`You must pass the initial network address`);
      }

      this.options = _.merge({
        hostname: '',  
        request: {
          clientConcurrency: 10,
          timeoutSlippage: 120,
          serverTimeout: '2s',
          pingTimeout: '1s'   
        },
        network: {
          autoSync: true,
          syncInterval: '10s',
          isTrusted: false,
          secretKey: '',
          serverMaxFails: 5,
          whitelist: [],
          blacklist: []
        },
        server: {
          https: false,
          maxBodySize: '500kb'
        },
        behavior: {
          candidateSuspicionLevel: 5,
          failSuspicionLevel: 10,
          failLifetime: '1d',          
          banLifetime: '27d'
        },
        logger: {
          level: 'info'
        },
        task: {      
          calculateCpuUsageInterval: '1s'
        }
      }, options);

      !this.options.logger && (this.options.logger = { level: false }); 
      this.port = this.options.port;
      this.publicPort = this.options.publicPort || this.port;
      this.initialNetworkAddress = this.options.initialNetworkAddress;
      this.DatabaseTransport = this.constructor.DatabaseTransport;
      this.ServerTransport = this.constructor.ServerTransport;
      this.LoggerTransport = this.constructor.LoggerTransport;  
      this.TaskTransport = this.constructor.TaskTransport;     
      this.__cpuUsageInterval = 900,
      this.__maxCandidates = 500;
      this.__initialized = false;
      this.__syncInterval = null;
      this.__cpuUsage = 0;
      this.__requestQueue = {};
      this.__requestQueueInterval = 10;
      this.prepareOptions();
    }    

    /**
     * Initialize the node
     * 
     * @async
     */
    async init() {
      this.hostname = this.options.hostname || (await this.getExternalIp()) || (await this.getLocalIp());
      this.address = utils.createAddress(this.hostname, this.publicPort);
      this.ip = await utils.getHostIp(this.hostname);

      if(!this.ip) {
        throw new Error(`Hostname ${this.hostname} is not found`);
      }

      await this.prepareServices();
      await this.prepareBehavior();
      await this.initServices();     
      await super.init.apply(this, arguments);
      
      if(!this.options.server) {
        return;
      }
      
      await this.checkNodeAddress(this.address);

      if(this.options.network.autoSync) {
        this.__syncInterval = setInterval(async () => {
          try {
            await this.sync.call(this);
          }
          catch(err) {
            this.logger.error(err.stack);
          }          
        }, this.options.network.syncInterval);
      }
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

    async prepareBehavior() {
      await this.db.addBehaviorFailOptions('requestDelays', { ban: false });
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
    }

    /**
     * Deinitialize the services
     * 
     * @async
     */
    async deinitServices() {
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
      this.server && await this.server.destroy();    
      this.task && await this.task.destroy();
      this.db && await this.db.destroy();
      this.logger && await this.logger.destroy();
    }

    /**
     * Check the node address
     * 
     * @async
     */
    async checkNodeAddress(address) {
      const result = await this.request(`${address}/ping`, {
        method: 'GET',
        timeout: this.options.request.pingTimeout
      });

      if(result.address != this.address) {
        throw new Error(`Host ${this.address} is wrong`);
      }
    }

    /**
     * Get an external ip address of the host
     * 
     * @async
     * @returns {string}
     */
    async getExternalIp() {
      try {
        return await new Promise((resolve, reject) => externalIp()(((err, ip) => err? reject(err): resolve(ip))));
      }
      catch(err) {
        return null;
      }
    }

    /**
     * Get a local ip address of the host
     * 
     * @async
     * @returns {string}
     */
    async getLocalIp() {
      const interfaces = os.networkInterfaces();
      let ip;
      
      for (let k in interfaces) {
        for (let p in interfaces[k]) {
          var address = interfaces[k][p];
          if (address.family === 'IPv4' && !address.internal) {
            ip = address.address;
          }
        }
      }

      return ip;
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
     */
    async syncDown() {
      const slaves = await this.db.getSlaves();  

      if(!slaves.length) {
        return [];
      }

      let actualMasters = [];
      const results = await this.provideGroupStructure(slaves);

      for(let i = 0; i < results.length; i++) {
        const result = results[i];
        const masters = result.masters;
        const backlink = result.backlink;
        const address = result.address;
        const slaves = result.slaves;
        const availability = result.availability;

        if(!backlink || backlink.address != this.address) {
          await this.db.removeSlave(address);
          await this.db.addBehaviorFail('slaveBacklink', address);
        }
        else {
          await this.db.addSlave(address, availability);
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
     */
    async syncUp() {
      const backlink = await this.db.getBacklink();

      if(!backlink) {
        return [];
      }

      let result;

      try {
        result = await this.provideStructure(backlink.address);          
      }
      catch(err) {
        this.logger.warn(err.stack);
        return [];
      }

      const slaves = result.slaves;
      const masters = result.masters;
      const grandlink = result.backlink;      

      if(!slaves.find(s => s.address == this.address)) {
        await this.db.removeBacklink();
        await this.db.addBehaviorFail('backlinkSlaves', backlink.address);
        return [];
      }
      else {
        await this.db.subBehaviorFail('backlinkSlaves', backlink.address);
      }

      const chain = this.createBacklinkChain(backlink.address, grandlink? grandlink.chain: []);
      await this.db.addBacklink(backlink.address, chain);

      if(await this.isMaster()) {
        masters.forEach(m => m.source = backlink.address);
      }
      else {
        await this.db.setData('members', result.members);
      }

      return masters;
    }

    /**
     * Synchronize the node with the network
     * 
     * @async
     */
    async sync() {
      const startTime = Date.now();
      await this.cleanUpServers();
      const slaves = await this.db.getSlaves();
      const size = slaves.length;
      size? await this.db.addMaster(this.address, size): await this.db.removeMaster(this.address);      
      const mastersUp = await this.syncUp();
      const mastersDown = await this.syncDown();
      const actualMasters = [].concat(mastersUp, mastersDown);

      if(size) {
        const masters = await this.db.getMasters();
        masters.forEach(m => m.source = this.address);
        const structures = await this.updateMastersInfo([].concat(masters, actualMasters));
        const members = slaves.concat(structures.reduce((p, c) => p.concat(c.slaves), []));
        await this.db.setData('members', members.map(m => _.pick(m, ['address', 'availability'])));
        await this.checkMasterStructures(structures);
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

        await this.normalizeMastersStatus();
      }
      
      await this.normalizeMembers();
      await this.normalizeMastersCount();
      await this.normalizeSlavesCount();
      await this.normalizeInitialAddress();
      
      try {
        await this.register();
      }
      catch(err) {
        if(err instanceof errors.WorkError) {
          this.logger.warn(err.stack);
        }
        else {
          throw err;
        }
      }      
      
      await this.db.normalizeBehaviorFails();
      await this.db.normalizeBanlist();
      await this.db.normalizeBehaviorCandidates();
      await this.db.normalizeServers();
      this.logger.info(`Sync takes ${ms(Date.now() - startTime)}`);
    }

    /**
     * Check the masters structure
     * 
     * @async
     * @param {object[]} structures
     */
    async checkMasterStructures(structures) {
      if(this.options.network.isTrusted || !await this.isMaster()) {
        return;
      }

      const checked = await this.db.getData('checkedMasterStructures');
      const current = structures.filter(s => checked.indexOf(s.address) == -1 && s.address != this.address)[0];

      if(!current) {
        await this.db.setData('checkedMasterStructures', []);
        return;
      }

      checked.push(current.address);
      await this.checkServerStructure(current);
      await this.db.setData('checkedMasterStructures', checked);
    }
  
    /**
     * Check the server structure
     * 
     * @async
     * @param {object} server
     * @param {object[]} server.masters
     * @param {object[]} server.slaves
     */
    async checkServerStructure(server) {
      await this.checkServerStructureSlaves(server.address, server.slaves);
      await this.checkServerStructureNetworkSize(server.address, server.masters, server.slaves);      
    }

    /**
     * Check the server slaves
     * 
     * @async
     * @param {string} address 
     * @param {object[]} slaves
     */
    async checkServerStructureSlaves(address, slaves) {
      const results = await this.provideGroupStructure(slaves, { includeErrors: true });
      let suspicious = 0;

      for(let i = 0; i < results.length; i++) {
        const result = results[i];

        if(result instanceof Error || !result.backlink || result.backlink.address != address) {
          suspicious++;
          continue;
        }
      }
      
      if(suspicious) {
        const val = suspicious / slaves.length;
        const fn = behavior => behavior? val * Math.sqrt(behavior.balance): val;
        await this.db.addBehaviorFail('serverSlavesBacklink', address, fn);
      }
      else {
        const fn = behavior => behavior? 1 / Math.sqrt(behavior.balance): 1;
        await this.db.subBehaviorFail('serverSlavesBacklink', address, fn);
      }
    }

    /**
     * Check the server network size
     * 
     * @async
     * @param {string} address 
     * @param {object[]} masters
     * @param {object[]} slaves
     */
    async checkServerStructureNetworkSize(address, masters, slaves) {
      const networkSize = await this.getNetworkSize(masters);
      const coef = await this.getNetworkOptimum(networkSize);
      const master = masters.find(m => m.address == address);

      if((master && master.size != slaves.length) || slaves.length > coef) {
        await this.db.addBehaviorFail('serverNetworkSize', address);
        return;
      }

      await this.db.subBehaviorFail('serverNetworkSize', address);
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
      const serverTimeout = this.getRequestServerTimeout();
      let timeout = timer([serverTimeout * 3, serverTimeout * 2]);
      
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
        throw new errors.WorkError(`Network hasn't been normalized yet, try later`, 'ERR_SPREADABLE_NETWORK_NOT_NORMALIZED');
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
        return false;
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
      
      await this.db.setData('registrationTime', Date.now());
      await this.db.addBacklink(winner.address, result.chain);
      await this.db.addMaster(winner.address, result.size);
      await this.db.clearBehaviorDelays('registration');      
      return true;
    } 

    /**
     * Interview the node
     * 
     * @async
     * @returns {object}
     */
    async interview(summary) {
      if(!summary || typeof summary != 'object') {
        throw new errors.WorkError('Not found the interview summary', 'ERR_SPREADABLE_INTERVIEW_NOT_FOUND_SUMMARY');
      }

      if(!utils.isValidHostname(utils.splitAddress(summary.address)[0])) {
        throw new errors.WorkError('Invalid interview summary address', 'ERR_SPREADABLE_INTERVIEW_INVALID_SUMMARY_ADDRESS');
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
      
      return { 
        availability: pretty? availability.toFixed(2): availability,
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
     */
    async updateMastersInfo(masters) {    
      const obj = {};
      const suspicious = {};
      const sources = {};
      const structures = [];
      
      for(let i = 0; i < masters.length; i++) {        
        const master = masters[i];
        const source = { size: master.size, address: master.source };        

        if(obj[master.address]) {
          obj[master.address].sources.push(source);
          !sources[master.source] && (sources[master.source] = []);
          sources[master.source].push(master);
          continue;
        }

        if(master.address == this.address) {
          continue;
        }

        if(!await this.isAddressAllowed(master.address)) {
          continue;
        }
        
        obj[master.address] = { master, sources: [source] };
        !sources[master.source] && (sources[master.source] = []);
        sources[master.source].push(master);
      }

      const arr = [];

      for(let key in obj) {
        const item = obj[key];        
        arr.push({ address: item.master.address, sources: item.sources });
      }

      const results = await this.provideGroupStructure(arr, { includeErrors: true });

      for(let i = results.length - 1; i >= 0; i--) {
        const result = results[i];
        const sources = arr[i].sources;
        const address = arr[i].address;
        let size = 0;

        if(!(result instanceof Error)) {
          size = result.slaves.length;
          size && structures.push(result);
        }
        
        if(!size) {
          await this.db.removeMaster(address);
          sources.forEach(s => ((suspicious[s.address] = (suspicious[s.address] || 0) + 1)));
          continue;
        }

        await this.db.addMaster(address, size);
        sources.forEach(s => (s.size != size && (suspicious[s.address] = (suspicious[s.address] || 0) + 1)));
      }
      
      for(let source in sources) {
        const mastersCount = sources[source].length; 

        if(suspicious[source] && source != this.address) {
          const val = suspicious[source] / mastersCount;
          const fn = behavior => behavior? val * Math.sqrt(behavior.balance): val;
          await this.db.addBehaviorFail('provideMasters', source, fn);
        }
        else {
          const fn = behavior => behavior? 1 / Math.sqrt(behavior.balance): 1;
          await this.db.subBehaviorFail('provideMasters', source, fn);
        }
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
     * Normalize the node masters status
     * 
     * @async
     */
    async normalizeMastersStatus() {
      if(this.options.network.isTrusted || !await this.db.getMastersCount()) {
        return;
      }
      
      const lifetime = await this.getMasterStatusLifetime();
      const time = await this.db.getData('masterStatusTime');
      
      if(!time || Date.now() - lifetime > time) {
        await this.requestMasters('walk');
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
     * Normalize the network members
     * 
     * @async
     */
    async normalizeMembers() {   
      const members = await this.db.getData('members');      
      const index = members.map(m => m.address).indexOf(this.address);
      let server;

      if(index == -1) {
        server = { address: this.address };
        members.push(server);       
      }
      else {
        server = members[index];
      }

      server.availability = await this.getAvailability();
      await this.db.setData('members', members);      
    }

    /**
     * Normalize the node initial address
     * 
     * @async
     */
    async normalizeInitialAddress() {   
      const lifetime = await this.getSyncLifetime();

      if(Date.now() - lifetime < this.__initialized) {
        return;
      }   

      const members = await this.db.getData('members');

      if(members.map(m => m.address).indexOf(this.initialNetworkAddress) == -1) {
        await this.db.removeBacklink();
      }
    }

    /**
     * Get the node backlink's chain
     * 
     * @async
     * @returns {string[]}
     */
    async getBacklinkChain() {
      const backlink = await this.db.getBacklink();

      if(!backlink) {
        return [this.address];
      }

      return this.createBacklinkChain(this.address, backlink.chain);
    }

    /**
     * Get the random node address from the network
     * 
     * @async
     * @returns {string} 
     */
    async getAvailableNode() {    
      const filterOptions = await this.getAvailabilityCandidateFilterOptions();
      const candidates = await this.filterCandidates(await this.db.getData('members'), filterOptions);
      const candidate = candidates[0];
      
      if(candidate) {
        await this.db.addBehaviorCandidate('getAvailablity', candidate.address);
      }
      
      if(!candidate) {
        return this.address;
      }

      return candidate.address;
    }

    /**
     * Get the availability filter options
     * 
     * @returns {object}
     */
    async getAvailabilityCandidateFilterOptions() {
      return {
        fnCompare: await this.createSuspicionComparisonFunction('getAvailablity', await this.createAvailabilityComparisonFunction()),
        limit: 1
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
     * Create an availability comparison function
     * 
     * @async
     * @returns {function}
     */
    async createAvailabilityComparisonFunction() {
      return (a, b) => b.availability - a.availability;
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
     * Filter the address
     * 
     * @param {string} address 
     */
    async addressFilter(address) {
      if(!utils.isValidAddress(address)) {
        throw new errors.AccessError(`Address "${address}" is invalid`);
      }

      if(address == this.address) {
        return;
      }

      let hostname = utils.splitAddress(address)[0];
      let ip;
      let ipv6;

      try {
        ip = await utils.getHostIp(hostname);
      }
      catch(err) {
        throw new errors.AccessError(`Hostname "${hostname}" is invalid`);
      }  
      
      if(!ip) {
        throw new errors.AccessError(`Ip address for "${hostname}" is invalid`);
      }

      const white = this.options.network.whitelist || [];
      const black = this.options.network.blacklist || [];
      ipv6 = utils.isIpv6(ip)? utils.getFullIpv6(ip): utils.ipv4Tov6(ip);

      if(await this.db.checkBanlistIp(ipv6)) {
        throw new errors.AccessError(`Ip "${ip}" is in the banlist`);
      }

      const checkListItem = (item) => {
        if(utils.isIpv6(item)) {
          item = utils.getFullIpv6(item);
        }

        return (item == address || item == hostname || item == ip || item == ipv6);
      }

      if(white.length) {
        let exists = false;
        
        for(let i = 0; i < white.length; i++) {
          if(checkListItem(white[i])) {
            exists = true;
            break;
          }
        }

        if(!exists) {
          throw new errors.AccessError(`Address "${address}" is denied`);
        }        
      }

      for(let i = 0; i < black.length; i++) {
        if(checkListItem(black[i])) {
          throw new errors.AccessError(`Address "${address}" is in the blacklist`);
        }
      }
    }

    /**
     * Get the structure provider
     * 
     * @async
     * @returns {string}
     */
    async getStructureProvider() {
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
      const provider = options.provider || await this.getStructureProvider();
      const timer = this.createRequestTimer(options.timeout);
      const serverTimeout = this.getRequestServerTimeout();
      
      if(provider == this.address) {        
        return await this.requestNode(target, 'structure', {
          responseSchema: schema.getStructureResponse(),
          timeout: timer(serverTimeout)
        }); 
      }

      try {
        const timeout = timer([serverTimeout * 2, serverTimeout]);

        return await this.requestNode(provider, 'provide-structure', {
          body: { 
            target, 
            timeout,
            timestamp: Date.now()
          },
          responseSchema: schema.getProvideStructureResponse(),
          timeout
        });
      }
      catch(err) {   
        const timeout = timer(serverTimeout);

        if(provider == this.address) {
          throw err;
        }

        this.logger.warn(err.stack);
        return await this.provideStructure(target, { provider: this.address, timeout });
      }    
    }

    /**
     * Provide the node's group structure 
     * 
     * @async
     * @param {array} targets
     * @returns {object[]}
     */
    async provideGroupStructure(targets, options = {}) {
      if(!targets.length) {
        return [];
      }

      const provider = options.provider || await this.getStructureProvider();
      const timer = this.createRequestTimer(options.timeout);
      const serverTimeout = this.getRequestServerTimeout();
      
      if(provider == this.address) {
        return await this.requestGroup(targets, 'structure', { 
          responseSchema: schema.getStructureResponse(),
          timeout: timer(serverTimeout),
          includeErrors: options.includeErrors
        });
      }

      let result;

      try {
        const timeout = timer([serverTimeout * 2, serverTimeout]);

        result = await this.requestNode(provider, 'provide-group-structure', {
          body: { 
            targets: targets.map(t => t.address), 
            timeout, 
            timestamp: Date.now() 
          },
          responseSchema: schema.getProvideGroupStructureResponse(),
          timeout
        });
      }
      catch(err) {
        if(provider == this.address) {
          throw err;
        }

        const timeout = timer(serverTimeout);
        this.logger.warn(err.stack);
        return await this.provideGroupStructure(targets, { provider: this.address, timeout });
      }

      let results = result.results.map(item => {
        if(item.message) {
          if(item.code) {
            item = new errors.WorkError(item.message, item.code);
          }
          else {
            item = new Error(item.message);
          }

          return item;
        }

        try {
          utils.validateSchema(schema.getStructureResponse(), item);
          return item;
        }
        catch(err) {
          err.code = 'ERR_SPREADABLE_RESPONSE_SCHEMA';
          return err;
        }
      });
      
      !options.includeErrors && (results = results.filter(r => !(r instanceof Error)));
      return results;
    }

    /**
     * Make a request
     * 
     * @async
     * @param {string} url - url without protocol
     * @param {object} [options]
     * @param {object} [options.url] - with protocol
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
      
      options = this.createDefaultRequestOptions(options);
      const urlInfo = urlib.parse(options.url);
      await this.addressFilter(`${urlInfo.hostname}:${urlInfo.port}`);
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
      else {
        options.headers['content-type'] = 'application/json';
        options.body = Object.keys(body).length? JSON.stringify(body): undefined;
      }
      
      const start = Date.now();        

      try {
        const result = await fetch(options.url, options);
        this.logger.info(`Request from "${this.address}" to "${options.url}": ${ms(Date.now() - start)}`);

        if(result.ok) {
          return options.getFullResponse? result: await result.json();
        }

        const body = await result.json();

        if(!body || typeof body != 'object') {
          throw new Error(body || 'Unknown error');
        }

        if(!body.code) {
          throw new Error(body.message);
        }
        
        throw new errors.WorkError(body.message, body.code);
      }
      catch(err) {
        //eslint-disable-next-line no-ex-assign
        utils.isRequestTimeoutError(err) && (err = utils.createRequestTimeoutError());
        err.requestOptions = options;
        throw err;
      }
    }

    /**
     * Request to the masters
     * 
     * @async
     * @param {string} action
     * @param {object} [options]
     * @param {number} [options.timeout]
     * @param {number} [options.masterTimeout]
     * @param {number} [options.slaveTimeout] 
     * @param {object} [options.body]
     * @returns {array}
     */
    async requestMasters(action, options = {}) {
      const preferredTimeout = this.getRequestMastersTimeout(options);
      const timeout = options.timeout || preferredTimeout;     
      const requests = [];
      let suspicious = 0;
      
      if(timeout < preferredTimeout) {
        this.logger.warn(`Request masters actual timeout "${timeout}" less than preferred "${preferredTimeout}"`);        
      }

      if(timeout <= 0) {
        return requests;
      }

      const body = options.body || {};
      const backlink =  await this.db.getBacklink();
      const masters = await this.db.getMasters();
      const slavesCount = await this.db.getSlavesCount();
      const servers = masters.length? masters: [{ address: this.address, size: slavesCount }];
      
      for(let i = 0; i < servers.length; i++) {
        const server = servers[i];
        
        requests.push(new Promise((resolve, reject) => {
          this.requestMaster(server.address, action, {
            body: Object.assign({}, body, {
              ignoreAcception: !masters.length,
              timeout, 
              timestamp: Date.now(),
              slaveTimeout: this.getRequestSlaveTimeout(options)
            }),
            timeout,
            preferredTimeout,
            getFullResponse: true,
            responseSchema: options.responseSchema
          })
          .then(async result => {
            const size = +result.headers.get("spreadable-master-size");

            if(size != server.size) {              
              await this.db.addMaster(server.address, size);
              !slavesCount && suspicious++;
            }

            resolve(result.__json);
          })
          .catch(async err => {    
            try {
              if(err instanceof errors.WorkError && err.code == 'ERR_SPREADABLE_MASTER_NOT_ACCEPTED') {
                await this.db.removeMaster(server.address);
                !slavesCount && suspicious++;
              }
              
              this.logger.warn(err.stack);
              resolve(err);
            }
            catch(err) {
              reject(err);
            }            
          })
        }));
      }          
      
      let results = await Promise.all(requests);
      !options.includeErrors && (results = results.filter(r => !(r instanceof Error)));
      await this.db.setData('masterStatusTime', Date.now());
      
      if(backlink && suspicious) {          
        const val = suspicious / masters.length;        
        const fn = behavior => behavior? val * Math.sqrt(behavior.balance): val;
        await this.db.addBehaviorFail('requestBacklinkMasters', backlink.address, fn);
      }
      else if(backlink) {
        const fn = behavior => behavior? 1 / Math.sqrt(behavior.balance): 1;
        await this.db.subBehaviorFail('requestBacklinkMasters', backlink.address, fn);
      }
      
      return results;
    }

    /**
     * Request to the slaves
     * 
     * @async
     * @param {string} action
     * @param {object} [options]
     * @param {number} [options.timeout]
     * @param {object} [options.body]
     * @param {number} [options.slaveTimeout] 
     * @returns {array}
     */
    async requestSlaves(action, options = {}) {
      const preferredTimeout = this.getRequestSlavesTimeout(options);
      const timeout = options.timeout || preferredTimeout;      
      const requests = []; 
      
      if(timeout < preferredTimeout) {
        this.logger.warn(`Request slaves actual timeout "${timeout}" less than preferred "${preferredTimeout}"`);
      }

      if(timeout <= 0) {
        return requests;
      }

      const body = options.body || {};
      const slaves = await this.db.getSlaves();
      const servers = slaves.length? slaves.map(m => m.address): [this.address];
      
      for(let i = 0; i < servers.length; i++) {
        const address = servers[i];

        requests.push(new Promise(resolve => {
          this.requestSlave(address, action, {
            body: Object.assign({}, body, {
              timeout,
              timestamp: Date.now()
            }),
            timeout,
            preferredTimeout,
            responseSchema: options.responseSchema
          })
          .then(resolve)
          .catch((err) => {
            this.logger.warn(err.stack);
            resolve(err);
          });
        }));
      }
       
      let results = await Promise.all(requests);
      !options.includeErrors && (results = results.filter(r => !(r instanceof Error)));     
      return results;
    }

    /**
     * Request to the master
     * 
     * @async
     * @param {string} address
     * @param {string} action
     * @param {object} [options]
     * @returns {object}
     */
    async requestMaster(address, action, options = {}) {
      options = _.merge({}, options, { timeout: options.timeout || this.getRequestMasterTimeout(options)});
      return await this.requestServer(address, `/api/master/${action}`, options);
    } 

    /**
     * Request to the slave
     * 
     * @async
     * @param {string} address
     * @param {string} action
     * @param {object} [options]
     * @returns {object}
     */
    async requestSlave(address, action, options = {}) {
      options = _.merge({}, options, { timeout: options.timeout || this.getRequestSlaveTimeout(options)});
      return await this.requestServer(address, `/api/slave/${action}`, options);
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
     * @param {string} action
     * @param {funcion} fn
     * @param {object} [options]
     * @returns {object}
     */
    async requestGroup(arr, action, options = {}) {
      const requests = [];

      for(let i = 0; i < arr.length; i++) {
        const item = arr[i];

        requests.push(new Promise(resolve => {
          this.requestNode(item.address, action, _.merge({}, options, item.options)).then(resolve).catch(resolve)
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
      const timeout = options.timeout || this.getRequestServerTimeout();      
      const start = Date.now();
      options.timeout = timeout;

      if(options.preferredTimeout) {
        const behavior = await this.db.getBehaviorFail('requestDelays', address);

        if(behavior && behavior.suspicion > 0 && options.timeout > options.preferredTimeout) {
          options.timeout = options.preferredTimeout;
        }
      }

      const handleDelays = async () => {
        if(!options.preferredTimeout || timeout < options.preferredTimeout) {
          return;
        }
        
        if(Date.now() - start >= options.preferredTimeout) {
          await this.db.addBehaviorFail('requestDelays', address);
        }
        else {
          await this.db.subBehaviorFail('requestDelays', address);
        }
      }

      try {
        let result = await this.request(`${address}/${url}`.replace(/[/]+/, '/'), options);
        let body = result;
        
        if(options.getFullResponse) {
          body = await result.json();
          result.__json = body;
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

        handleDelays();
        await this.db.successServerAddress(address);
        return result;
      }
      catch(err) {
        this.logger.warn(err.stack);
        handleDelays();       

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
     * @param {object|function} [options.formData]
     * @param {object|function} [options.body]
     * @returns {object}
     */
    async duplicateData(action, servers, options = {}) {
      options = _.merge({}, options);
      const timer = this.createRequestTimer(options.timeout);
      let result;

      while(servers.length) {
        const address = servers[0];

        if(options.formData) {
          typeof options.formData == 'function' && (options.formData = options.formData(address));
          servers.slice(1).forEach((val, i) => options.formData[`dublicates[${i}]`] = val);
        }
        else {
          typeof options.body == 'function' && (options.body = options.body(address));
          options.body.duplicates = servers.slice(1);
        }         
        
        try {      
          options.timeout = timer();
          result = await this.requestNode(address, action, options);
          return result;
        }
        catch(err) {
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
     * @returns {object}
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
     * @param {integer} [options.limit]
     * @param {object} [options.schema]
     * @param {function} [options.fnFilter]
     * @param {function} [options.fnCompare] 
     * @param {function} [options.fn]
     * @returns {object[]}
     */
    async filterCandidates(arr, options = {}) {
      const limit = options.limit === undefined || options.limit > this.__maxCandidates? this.__maxCandidates: options.limit;
      arr = arr.slice();

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
      
      options.fn && (arr = options.fn(arr));
      options.fnCompare && arr.sort(options.fnCompare);      
      limit && (arr = arr.slice(0, limit));
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
     * Prepare the options
     */
    prepareOptions() {
      this.options.request.timeoutSlippage = utils.getMs(this.options.request.timeoutSlippage);
      this.options.request.serverTimeout = utils.getMs(this.options.request.serverTimeout);
      this.options.request.pingTimeout = utils.getMs(this.options.request.pingTimeout);
      this.options.network.syncInterval = utils.getMs(this.options.network.syncInterval);
      this.options.behavior.failLifetime = utils.getMs(this.options.behavior.failLifetime);      
      this.options.behavior.banLifetime = utils.getMs(this.options.behavior.banLifetime);
    } 
    
    /**
     * Get the node backlink's chain
     * 
     * @async
     * @param {string} currentAddress
     * @param {string[]} chain
     * @returns {string[]}
     */
    createBacklinkChain(currentAddress, chain) {
      chain = [currentAddress].concat(chain || []);
      const arr = [];

      for(let i = 0; i < chain.length; i++) {
        const address = chain[i];

        if(arr.indexOf(address) != -1) {
          break;
        }

        arr.push(address);
      }

      return arr;
    }

    /**
     * Create request slaves options
     * 
     * @param {object} data 
     * @param {object} [options]
     * @returns {object}
     */
    createRequestSlavesOptions(body, options = {}) {
      return _.merge({
        body,
        timeout: options.timeout || this.createRequestTimeout(body),
        slaveTimeout: this.getRequestSlaveTimeout(body)
      }, options);
    }

    /**
     * Get the request server timeout
     * 
     * @returns {integer}
     */
    getRequestServerTimeout() {
      return this.options.request.serverTimeout;
    }

    /**
     * Get the request masters timeout
     * 
     * @see Node.prorotype.getRequestMasterTimeout
     */
    getRequestMastersTimeout(options = {}) {    
      return this.getRequestMasterTimeout(options);
    }

    /**
     * Get the request masters timeout
     * 
     * @param {object} [options]
     * @param {number} [options.masterTimeout]
     * @param {number} [options.slaveTimeout]
     * @returns {integer}
     */
    getRequestMasterTimeout(options = {}) {    
      const masterTimeout = options.masterTimeout || this.getRequestServerTimeout();      
      return masterTimeout + this.getRequestSlavesTimeout(options);
    }

    /**
     * Get the request slaves timeout
     * 
     * @see Node.prorotype.getRequestSlaveTimeout
     */
    getRequestSlavesTimeout(options = {}) {
      return this.getRequestSlaveTimeout(options);
    }   
    
    /**
     * Get the request slave timeout
     * 
     * @param {object} [options]
     * @param {number} [options.slaveTimeout]
     * @returns {integer}
     */
    getRequestSlaveTimeout(options = {}) {
      return options.slaveTimeout || this.getRequestServerTimeout();
    } 

    /**
     * Create a request timeout
     * 
     * @param {object} data 
     * @param {number} data.timeout 
     * @param {number} data.timestamp
     * @param {number} defaultTimeout
     */
    createRequestTimeout(data, defaultTimeout) {
      if(!data || typeof data != 'object' || !data.timeout) {
        return defaultTimeout || this.getRequestServerTimeout();
      }

      return (data.timeout - (Date.now() - data.timestamp)) - this.options.request.timeoutSlippage;
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
          'network-secret-key': this.options.network.secretKey,
          'original-address': this.address,
          'node-version': this.getVersion()
        }
      };

      if(options.timeout) {
        options.timeout = utils.getMs(options.timeout);
      }

      if(typeof this.options.server.https == 'object' && this.options.server.https.ca) {
        options.agent = options.agent || new https.Agent();
        options.agent.options.ca = this.options.server.https.ca;
      }

      return _.merge(defaults, options);
    }

    /**
     * Create a request timer
     * 
     * @param {number} timeout 
     * @returns {function}
     */
    createRequestTimer(timeout) { 
      return utils.getRequestTimer(timeout, { min: this.options.request.pingTimeout });
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
     * Get the node version
     * 
     * @returns {string}
     */
    getVersion() {
      return `${this.constructor.codename}-${pack.version.split('.')[0]}`;
    }    
  }
};