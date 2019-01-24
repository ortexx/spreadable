const externalIp = require('external-ip');
const os = require('os');
const v8 = require('v8');
const urlib = require('url');
const _ = require('lodash');
const request = require('request');
const DatabaseLoki = require('./db/transports/loki')();
const ServerExpress = require('./server/transports/express')();
const LoggerConsole = require('./logger/transports/console')();
const TaskInterval = require('./task/transports/interval')();
const prettyMs = require('pretty-ms');
const utils = require('./utils');
const errors = require('./errors');
const pack = require('../package');

module.exports = () => { 
  /**
   * Class to manage the node
   */
  return class Node {
    static get name () { return 'spreadable' }
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
      if(!options.port) {
        throw new Error('You must pass the necessary port');
      }

      if(!options.initialNetworkAddress) {
        throw new Error(`You must pass the initial server address of the network`);
      }

      this.options = _.merge({
        hostname: '',      
        request: {
          clientByEndpointConcurrency: 3,
          timeoutSlippage: 120,
          serverTimeout: '2s',
          pingTimeout: '1s'
        },
        network: {
          secretKey: '',
          serverMaxFails: 5,
          serverMaxDelays: 5,
          whitelist: [],
          blacklist: []
        },
        server: {
          https: false
        },
        behavior: {
          candidateSuspicionLevel: 5
        },
        logger: {
          level: 'info'
        },
        task: {      
          calculateCpuUsageInterval: '1s',
          syncInterval: '10s',
        }
      }, options);

      !this.options.logger && (this.options.logger = { level: false });    
    
      this.prepareOptions();
      this.port = this.options.port;
      this.initialNetworkAddress = this.options.initialNetworkAddress;
      this.DatabaseTransport = this.constructor.DatabaseTransport;
      this.ServerTransport = this.constructor.ServerTransport;
      this.LoggerTransport = this.constructor.LoggerTransport;  
      this.TaskTransport = this.constructor.TaskTransport;
      this.CacheTransport = this.constructor.CacheTransport;
      this.__cpuUsageInterval = 900,
      this.__maxCandidates = 500;
      this.__initialized = false;
      this.__cpuUsage = 0;
      this.__requestQueue = {};
    }    

    /**
     * Initialize the node
     * 
     * @async
     */
    async init() {
      this.hostname = this.options.hostname || (await this.getExternalIp()) || (await this.getLocalIp());
      this.address = utils.createAddress(this.hostname, this.port);
      this.ip = await utils.getHostIp(this.hostname);

      if(!this.ip) {
        throw new Error(`Hostname ${this.hostname} is not found`);
      }
      
      if(await utils.isPortUsed(this.port)) {
        throw new Error(`Port ${this.port} is already used`);
      }

      await this.prepareServices();
      await this.initServices();
      await this.checkNodeAddress(this.address);

      if(this.options.server.https === true && !this.options.hostname) {
        this.logger.warn('If you use your own https server, you probably need to pass the domain name in option "hostname"');
      }
      
      this.__initialized = Date.now();
      await this.sync();
    }

    /**
     * Deinit the node
     * 
     * @async
     */
    async deinit() { 
      if(!this.isInitialized()) {
        return;
      }

      await this.deinitServices();
      this.__initialized = false;
      //eslint-disable-next-line no-console  
      console.info(`Node has been deinitialized`);
    }

    /**
     * Destroy the node
     * 
     * @async
     */
    async destroy() { 
      this.initializationFilter();
      await this.destroyServices();
      this.__initialized = false;
      //eslint-disable-next-line no-console  
      console.info(`Node has been destroyed`);
    }

    /**
     * Prepare the sevices
     * 
     * @async
     */
    async prepareServices() {
      this.logger = new this.LoggerTransport(this, _.merge({}, this.options.logger));      
      this.db = new this.DatabaseTransport(this, _.merge({}, this.options.db ));
      this.server = new this.ServerTransport(this, _.merge({}, this.options.server, { port: this.port }));    
      this.options.task && (this.task = new this.TaskTransport(this, _.merge({}, this.options.task)));

      if(this.task) {
        this.task.add('calculateCpuUsage', this.options.task.calculateCpuUsageInterval, () => this.calculateCpuUsage());
        this.task.add('sync', this.options.task.syncInterval, () => this.sync());        
      }
      else {
        this.logger.warn('You have to enable tasks if you use the node in production');
      }
    }

    /**
     * Initialize the services
     * 
     * @async
     */
    async initServices() {
      this.logger && await this.logger.init();      
      await this.db.init();
      await this.server.init(); 
      this.task && await this.task.init();
    }

    /**
     * Denitialize the services
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
     * Get an external ip of the host
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
     * Get local ip of the host
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
     * Check the node is master
     * 
     * @async
     * @returns {boolean}
     */
    async isMaster() {
      this.initializationFilter();
      return await this.db.isMaster();
    }

    /**
     * Calculate cpu usage
     * 
     * @async
     */
    async calculateCpuUsage() {
      this.__cpuUsage = await utils.getCpuUsage({ timeout: this.__cpuUsageInterval });
    }
    
    /**
     * Synchronize the node with slave nodes
     * 
     * @aync
     */
    async syncDown() {
      this.initializationFilter();
      const masters = (await this.db.getMasters(false)).map(s => _.pick(s, ['address', 'size', 'updatedAt', 'isAccepted']));
      const slaves = await this.db.getSlaves();      

      if(!slaves.length) {
        return;
      }

      const promises = [];
      const backlinkChain = await this.getBacklinkChain();

      for(let i = 0; i < slaves.length; i++) {
        const slave = slaves[i];

        promises.push(new Promise(async (resolve, reject) => {
          try {
            let result;

            try {
              result = await this.requestSlave(slave.address, 'sync-down', {
                body: {
                  backlinkChain,
                  masters,
                  target: this.address
                }
              });
            }
            catch(err) {
              if(err instanceof errors.WorkError) {
                this.logger.error(err.stack);           
              }
              else {
                this.logger.warn(err.stack);
              }              
            }

            if(result && !result.hasTargetMaster) {
              await this.db.removeSlave(slave.address);
            }

            resolve();
          }
          catch(err) {
            reject(err);
          }          
        }));
      }

      await Promise.all(promises);
    }    

    /**
     * Synchronize the node with master nodes
     * 
     * @aync
     */
    async syncUp() {
      this.initializationFilter();      
      const masters = (await this.db.getMasters(false)).map(s => _.pick(s, ['address', 'size', 'updatedAt', 'isAccepted']));
      const backlink = await this.db.getBacklink();

      if(!backlink) {
        return;
      }

      let result;

      try {
        result = await this.requestSlave(backlink.address, 'sync-up', {
          body: {
            masters,
            target: this.address
          }
        });          
      }
      catch(err) {
        if(err instanceof errors.WorkError) {
          throw err;            
        }
        else {
          this.logger.warn(err.stack);
        }
      }
      
      if(result && !result.hasTargetSlave) {
        await this.db.removeBacklink(backlink.address);
      }
    }

    /**
     * Synchronize the node with the network
     * 
     * @aync
     */
    async sync() {
      this.initializationFilter();
      const size = await this.db.getSlavesCount();
      size? await this.db.addMaster(this.address, size): await this.db.removeMaster(this.address);
      await this.cleanUpServers();
      await this.syncUp();
      await this.syncDown();
      await this.normalizeMastersCount();
      await this.normalizeBacklinkChain();
      
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
      
      await this.db.normalizeServers();
      await this.db.normalizeCandidates();
    }    
  
    /**
     * Register the node in the network
     * 
     * @async
     */
    async register() {
      this.initializationFilter();

      if(await this.db.getBacklink()) {
        return;
      }

      let result = await this.requestSlave(this.initialNetworkAddress, 'provide-registration', {
        body: {
          target: this.address
        },
        timeout: this.getRequestMastersTimeout() + this.getRequestServerTimeout()
      });
        
      const results = result.results;
      const candidates = [];
      const freeMasters = [];
      let mastersCount = 0;
      let sizes = [];
      let winner;

      for(let i = 0; i < results.length; i++) {
        const res = results[i]; 
        res.candidate && candidates.push(res.candidate);
        res.isFree && res.address != this.address && freeMasters.push(res);
        sizes.push(res.networkSize);
        res.isMaster && mastersCount++;
      }      

      if(freeMasters.length) {
        winner = freeMasters.sort((a, b) => b.count - a.count)[0];
      }
      else {          
        winner = utils.getRandomElement(candidates);
      }

      const uniq = _.uniq(sizes);
      const networkSize = uniq[0] || 1;

      if((sizes.length && uniq.length > 1) || mastersCount > Math.floor(Math.sqrt(networkSize)) + 1) {
        throw new errors.WorkError(`Network hasn't been normalized yet, try later`, 'ERR_SPREADABLE_NETWORK_NOT_NORMALIZED');
      }
      
      if(!winner || winner.address == this.address) {
        return false;
      }

      try {
        result = await this.requestSlave(winner.address, 'register', {
          body: {
            target: this.address
          }
        });
  
        await this.db.addBacklink(winner.address, result.backlinkChain);
      }
      catch(err) {
        if(err instanceof errors.WorkError) {
          throw err;
        }
        else {
          this.logger.warn(err.stack);
          throw new errors.WorkError('Master is not available for registration', 'ERR_SPREADABLE_MASTER_NOT_AVAILABLE');
        }
      }      
    } 

    /**
     * Interview the node
     * 
     * @async
     * @returns {object}
     */
    async interview(summary) {
      if(!summary || typeof summary != 'object') {
        throw new errors.WorkError('Not found an interview summary', 'ERR_SPREADABLE_INTERVIEW_NOT_FOUND_SUMMARY');
      }

      if(!utils.isValidHostname(utils.splitAddress(summary.address)[0])) {
        throw new errors.WorkError('Invalid interview summary address', 'ERR_SPREADABLE_INTERVIEW_INVALID_SUMMARY_ADDRESS');
      }
    }

    /**
     * Get an interview summary
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
     * Get the node backlink's chain
     * 
     * @async
     * @returns {string[]}
     */
    async getBacklinkChain() {
      this.initializationFilter();
      const backlink = await this.db.getBacklink();

      if(!backlink) {
        return [this.address];
      }

      const chain = [this.address].concat(backlink.chain || []);
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
     * Get the node status info
     * 
     * @async
     * @param {boolean} [pretty=false]
     * @returns {object}
     */
    async getStatusInfo(pretty = false) {
      const availability = await this.getAvailability(); 
      const networkSize = await this.getNetworkSize();
      
      return { 
        availability: pretty? availability.toFixed(2): availability, 
        isMaster: await this.isMaster(),
        isNormalized: await this.isNormalized(),
        registered: !!(await this.db.getBacklink()) || networkSize == 1,
        networkSize: await this.getNetworkSize()
      }
    }

    /**
     * Get servers status lifetime
     * 
     * @async
     * @returns {number}
     */
    async getSyncLifetime() {
      this.initializationFilter();
      const delay = utils.getMs(this.options.task.syncInterval);   
      const networkSize = await this.getNetworkSize();
      return delay * this.options.network.serverMaxFails * Math.ceil(Math.sqrt(networkSize));
    }

    /**
     * Check the node is normalized
     * 
     * @async
     * @returns {boolean}
     */
    async isNormalized() {
      this.initializationFilter();
      return Date.now() - await this.getSyncLifetime() > this.__initialized;
    }

    /**
     * Update the node masters info
     * 
     * @async
     */
    async updateMastersInfo(actualMasters) {
      this.initializationFilter();
      const masters = await this.db.getMasters(false);
      const lifetime = await this.getSyncLifetime();
      const now = Date.now();
      const obj = {};

      for(let i = 0; i < masters.length; i++) {
        const master = masters[i];
        obj[master.address] = master;
      }

      for(let i = 0; i < actualMasters.length; i++) {
        const master = actualMasters[i];

        if(obj[master.address] && obj[master.address].updatedAt >= master.updatedAt) {
          continue;
        }
        
        if(master.updatedAt < now - lifetime) {
          continue;
        }

        await this.db.addMaster(master.address, master.size, master.isAccepted, master.updatedAt);
      }
    }

    /**
     * Clean up the node servers
     * 
     * @async
     */
    async cleanUpServers() {
      this.initializationFilter();
      const lifetime = await this.getSyncLifetime();
      const servers = await this.db.getServers();

      if(Date.now() - lifetime <= this.__initialized) {
        return;
      }

      for(let i = servers.length - 1; i >= 0; i--) {
        const server = servers[i];

        if(server.isBroken) {
          server.updatedAt < Date.now() - lifetime && await this.db.removeServer(server.address); 
          continue;
        }

        if(server.isMaster) {
          server.updatedAt < Date.now() - lifetime && await this.db.removeMaster(server.address); 
        }
      }
    }

    /**
     * Normalize the node masters count
     * 
     * @async
     */
    async normalizeMastersCount() {
      this.initializationFilter();

      if(!(await this.isMaster())) {
        return;
      }
      
      const masters = _.orderBy(await this.db.getMasters(), ['size', 'address'], ['desc', 'asc']);
      const count = masters.length;
      const size = Math.floor(Math.sqrt(await this.getNetworkSize())) + 1;     
      
      if(count > size) {
        const actualMasters = masters.slice(0, size).map(m => m.address);
        actualMasters.indexOf(this.address) == -1 && await this.db.removeSlaves();
      }
    }

    /**
     * Normalize the node backlink chain
     * 
     * @async
     */
    async normalizeBacklinkChain() {
      this.initializationFilter();
      const backlinkChain = await this.getBacklinkChain();

      if(backlinkChain.length > 1 && backlinkChain.indexOf(this.initialNetworkAddress) == -1) {
        await this.db.removeBacklink();
      }
    }

    /**
     * Get random node address from the network
     * 
     * @async
     * @param {object} [options]
     * @returns {string} 
     */
    async getAvailableNode(options = {}) {
      this.initializationFilter();
      
      const results = await this.requestMasters('get-available-node', {
        timeout: options.timeout
      });
      
      const filterOptions = await this.getAvailabilityCandidateFilterOptions();
      const candidates = this.filterCandidatesMatrix(results.map(r => r.candidates), filterOptions);
      const candidate = candidates[0];

      if(candidate) {
        await this.db.addCandidate(candidate.address, 'getAvailablity');
      }
      
      if(!candidate || !(await this.checkHostnameIsAllowed(utils.splitAddress(candidate.address)[0]))) {
        return this.address;
      }

      return candidate.address;
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
      const arr = await this.db.getSuspiciousCandidates(action);      
      arr.forEach(candidate => {
        let level = candidate.suspicion - candidate.exculpation;
        obj[candidate.address] = level < 0? 0: level;
      });
      return obj; 
    }

    /**
     * Get availability filter options
     * 
     * @returns {object} - { [fnCompare], [schema], [limit] }
     */
    async getAvailabilityCandidateFilterOptions() {
      return {
        fnCompare: await this.createCandidatesComparisonFunction('getAvailablity', (a, b) => b.availability - a.availability),
        schema: { availability: 1 },
        limit: 1
      }
    }

     /**
     * Prepare candidates suspicion info
     * 
     * @async
     * @param {function} fn 
     * @returns {function}
     */
    async createCandidatesComparisonFunction(action, fn) {
      const obj = await this.prepareCandidateSuscpicionInfo(action);

      return (a, b) => {
        const suspicionLevelA = obj[a.address] || 0;
        const suspicionLevelB = obj[b.address] || 0;

        if(suspicionLevelA == suspicionLevelB) {
          return fn(a, b);
        }
        
        return suspicionLevelA - suspicionLevelB;
      }
    }

    /**
     * Check hostname address is allowed
     */
    async checkHostnameIsAllowed() {
      try {
        await this.hostnameFilter(...arguments);
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
     * Filter hostname
     * 
     * @param {string} hostname 
     */
    async hostnameFilter(hostname) {
      let ip;
      let ipv6;

      try {
        ip = await utils.getHostIp(hostname);
      }
      catch(err) {
        throw new errors.AccessError(`Hostname ${hostname} is invalid`);
      }           

      if(!utils.isValidHostname(ip)) {
        throw new errors.AccessError(`Hostname ${ip} is invalid`);
      }

      const white = this.options.network.whitelist || [];
      const black = this.options.network.blacklist || [];
      ipv6 = utils.isIpv6(ip)? utils.getFullIpv6(ip): utils.ipv4Tov6(ip);

      if(white.length && white.indexOf(ip) == -1 && white.indexOf(hostname) == -1 && white.indexOf(ipv6) == -1) {
        throw new errors.AccessError(`Hostname ${ip} is denied`);
      }

      if(black.length && (black.indexOf(ip) != -1 || black.indexOf(hostname) != -1 || black.indexOf(ipv6) != -1)) {
        throw new errors.AccessError(`Hostname ${ip} is in blacklist`);
      }
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
      if(typeof url == 'object') {
        options = url;        
      } 
      else {
        options.url = `${this.options.server.https? 'https': 'http'}://${url}`;
      }

      options = this.createDefaultRequestOptions(options);
      await this.hostnameFilter(urlib.parse(options.url).hostname);      
      
      return await new Promise((resolve, reject) => {
        const start = Date.now();

        const req = request(options, (err, res, body) => {
          try {
            this.logger.info(`Request from "${this.address}" to "${options.url}":`, prettyMs(Date.now() - start));

            if(err) {
              utils.isRequestTimeoutError(err) && (err = utils.createRequestTimeoutError());
              err.requestOptions = options;
              return reject(err);
            }

            const result = options.getResponseInstance? res: body;

            if(res.statusCode < 400) {
              return resolve(result);
            }

            if(!body || typeof body != 'object') {
              return reject(new Error(body || 'Unknown error'));
            }

            if(!body.code) {
              return reject(new Error(body.message));
            }

            err = new errors.WorkError(body.message, body.code);          
            reject(err);
          }
          catch(err) {
            reject(err);
          }
        });

        options.getRequest && options.getRequest(req);
      });
    }

    /**
     * Request to masters
     * 
     * @async
     * @param {string} action
     * @param {object} [options]
     * @param {number} [options.timeout]
     * @param {object} [options.body]
     * @returns {array}
     */
    async requestMasters(action, options = {}) {
      const preferredTimeout = this.getRequestMastersTimeout();
      const timeout = options.timeout || preferredTimeout;
      const body = options.body || {};
      const masters = await this.db.getMasters();
      const servers = masters.length? masters.map(m => m.address): [this.address];
      const requests = [];

      if(timeout < preferredTimeout) {
        this.logger.warn(`Request masters actual timeout "${timeout}" less than preferred "${preferredTimeout}"`);
      }
      
      if(timeout <= 0) {
        return requests;
      }
      
      for(let i = 0; i < servers.length; i++) {
        const address = servers[i];

        requests.push(new Promise((resolve, reject) => {
          this.requestServer(address, `/api/master/${action}`, {
            body: Object.assign({}, body, {
              ignoreAcception: !masters.length,
              timeout,
              timestamp: Date.now()
            }),
            timeout,
            preferredTimeout
          })
          .then(resolve)
          .catch(async (err) => {          
            try {
              if(err instanceof errors.WorkError && err.code == 'ERR_SPREADABLE_MASTER_NOT_ACCEPTED') {
                await this.db.addMaster(address, 0, false);
              }
              
              this.logger.warn(err.stack);
              resolve(null);
            }
            catch(err) {
              reject(err);
            }            
          })
        }));
      }
        
      return (await Promise.all(requests)).filter(r => r);
    }

    /**
     * Request to slaves
     * 
     * @async
     * @param {string} action
     * @param {object} [options]
     * @param {number} [options.timeout]
     * @param {object} [options.body]
     * @returns {array}
     */
    async requestSlaves(action, options = {}) {
      const preferredTimeout = this.getRequestSlavesTimeout();
      const timeout = options.timeout || preferredTimeout;
      const body = options.body || {};
      const slaves = await this.db.getSlaves();
      const servers = slaves.length? slaves.map(m => m.address): [this.address];
      const requests = []; 
      
      if(timeout < preferredTimeout) {
        this.logger.warn(`Request slaves actual timeout "${timeout}" less than preferred "${preferredTimeout}"`);
      }

      if(timeout <= 0) {
        return requests;
      }
      
      for(let i = 0; i < servers.length; i++) {
        const address = servers[i];

        requests.push(new Promise((resolve) => {
          this.requestSlave(address, action, {
            body: Object.assign({}, body, {
              timeout,
              timestamp: Date.now()
            }),
            timeout,
            preferredTimeout
          })
          .then((obj) => {
            obj.address = address;
            resolve(obj);
          })
          .catch(() => resolve(null));
        }));
      }
        
      return (await Promise.all(requests)).filter(r => r);
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
      return await this.requestServer(address, `/api/slave/${action}`, options);
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
      options.timeout = options.timeout || this.getRequestServerTimeout();
      let body = options.formData;
      let bodyType = 'formData';

      if(!body) {
        bodyType = 'body';
        body = options.body || {};
      } 

      body.source = this.address;
      options[bodyType] = body;
      const start = Date.now();

      if(options.preferredTimeout) {
        const server = await this.db.getServer(address);

        if(server && server.delays > 0 && options.timeout > options.preferredTimeout) {
          options.timeout = options.preferredTimeout;
        }
      }

      const handleDelays = async () => {
        if(Date.now() - start >= options.preferredTimeout) {
          await this.db.increaseServerDelays(address);
        }
        else {
          await this.db.decreaseServerDelays(address);
        }
      }

      try {
        const result = await this.request(`${address}/${url}`.replace(/[/]+/, '/'), options);
        options.preferredTimeout && handleDelays();
        await this.db.successServerAddress(address);
        return result;
      }
      catch(err) {
        options.preferredTimeout && handleDelays();

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
     * Check http request's client access and get his rights
     * 
     * @async
     * @param {http.ClientRequest} req
     * @returns {object}
     */
    async networkAccess() {
      this.initializationFilter();
    }

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
     * @aync
     * @returns {integer}
     */
    async getNetworkSize() {
      return await this.db.getNetworkSize();
    }

    /**
     * Get candidate suspicion level
     * 
     * @aync
     * @returns {integer}
     */
    async getCandidateSuspicionLevel() {
      const max = await this.getCandidateMaxSuspicionLevel();      
      const level = this.options.behavior.candidateSuspicionLevel;
      return max > level? level: max;
    }

    /**
     * Get candidate suspicion level
     * 
     * @aync
     * @returns {integer}
     */
    async getCandidateExculpationStep() {
      const level = await this.getCandidateSuspicionLevel();
      return (1 / level) * Math.sqrt(level);
    }

    /**
     * Get candidate max suspicion level
     * 
     * @aync
     * @returns {integer}
     */
    async getCandidateMaxSuspicionLevel() {
      return Math.cbrt(Math.pow(await this.getNetworkSize() - 1, 2));
    }

    /**
     * Prepare the options
     */
    prepareOptions() {
      this.options.request.timeoutSlippage = utils.getMs(this.options.request.timeoutSlippage);
      this.options.request.serverTimeout = utils.getMs(this.options.request.serverTimeout);
      this.options.request.pingTimeout = utils.getMs(this.options.request.pingTimeout);
      this.options.network.whitelist = this.options.network.whitelist.map(ip => utils.isIpv6(ip)? utils.getFullIpv6(ip): ip);
      this.options.network.blacklist = this.options.network.blacklist.map(ip => utils.isIpv6(ip)? utils.getFullIpv6(ip): ip);
    }

    /**
     * Filter the candidates matrix
     * 
     * @param {array[]} arr
     * @see Node.prototype.filterCandidates
     */
    filterCandidatesMatrix(matrix, options = {}) {
      let candidates = [];

      for(let i = 0; i < matrix.length; i++) {
        candidates = this.filterCandidates(candidates.concat(matrix[i]), options);
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
     * @param {function} [options.fnCompare]
     */
    filterCandidates(arr, options = {}) {
      const limit = options.limit > this.__maxCandidates? this.__maxCandidates: options.limit;
      const schema = options.schema;
      const fn = options.fnCompare || ((a, b) => a - b);
      arr = arr.slice();

      const createSchemaHash = (schema) => {
        const obj = {};
        Object.keys(schema).sort().forEach((key) =>  obj[key] = typeof schema[key]);
        return JSON.stringify(obj);
      };

      if(schema) {
        !schema.address && (schema.address = 'localhost:80');
        const schemaStr = createSchemaHash(schema);
        arr = arr.filter((item) => createSchemaHash(item) == schemaStr);
      }
      
      arr = arr.sort(fn);
      limit && (arr = arr.slice(0, limit));
      return arr;
    }

    /**
     * Get request server timeout
     * 
     * @returns {integer}
     */
    getRequestServerTimeout() {
      return this.options.request.serverTimeout;
    }

    /**
     * Get request masters timeout
     * 
     * @returns {integer}
     */
    getRequestMastersTimeout() {
      return this.getRequestSlavesTimeout() + this.getRequestServerTimeout();
    }

     /**
     * Get request slaves timeout
     * 
     * @returns {integer}
     */
    getRequestSlavesTimeout() {
      return this.getRequestServerTimeout();
    }    

    /**
     * Create a request timeout
     * 
     * @param {object} data 
     * @param {number} data.timeout 
     * @param {number} data.timestamp
     */
    createRequestTimeout(data) {
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
        json: true,
        headers: {
          'network-secret-key': this.options.network.secretKey,
          'original-hostname': this.hostname,
          'node-version': this.getVersion()
        }
      };

      if(options.timeout) {
        options.timeout = utils.getMs(options.timeout);
      }

      if(typeof this.options.server.https == 'object' && this.options.server.https.ca) {
        defaults.ca = this.options.server.https.ca;
      }

      return _.merge({}, defaults, options);
    }

    /**
     * Get node version
     * 
     * @returns {string}
     */
    getVersion() {
      return this.constructor.name + pack.version.split('.')[0];
    }

    /**
     * Check the node is initialized
     * 
     * @returns {boolean}
     */
    isInitialized() {
      return this.__initialized;
    }

    /**
     * Check the node is initialized and throw an exeption if not
     */
    initializationFilter() {
      if(!this.isInitialized()) {
        throw new Error('Node must be initialized at first');
      }
    }
  }
};