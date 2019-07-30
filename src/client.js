const merge = require('lodash/merge');
const fetch = require('node-fetch');
const FormData = require('form-data');
const https = require('https');
const qs = require('querystring');
const utils = require('./utils');
const errors = require('./errors');
const ms = require('ms');
const LoggerConsole = require('./logger/transports/console')();
const TaskInterval = require('./task/transports/interval')();
const Service = require('./service')();

module.exports = (Parent) => {
  /**
   * Class to manage client requests to the network
   */
  return class Client extends (Parent || Service) {
    static get LoggerTransport () { return LoggerConsole }
    static get TaskTransport () { return TaskInterval }

    /**
     * @param {object} options
     * @param {string|string[]} options.address
     */
    constructor(options = {}) {
      super(...arguments);

      if(!options.address) {
        throw new Error('You must pass the node address in "ip:port" format');
      }

      this.options = merge({
        request: {
          pingTimeout: '1s',
          clientTimeout: '8s'
        },
        secretKey: '',
        https: false,
        logger: {
          level: 'info'
        },
        task: {
          workerChangeInterval: '5m'
        }
      }, options);

      !this.options.logger && (this.options.logger = { level: false });
      this.LoggerTransport = this.constructor.LoggerTransport;
      this.TaskTransport = this.constructor.TaskTransport;
      this.address = options.address;
      this.prepareOptions();
    }

    /**
     * Initialize the client
     * 
     * @async
     */
    async init() {
      await this.prepareServices();
      await this.initServices();
      const addresses = Array.isArray(this.address)? this.address: [this.address];
      const availableAddress = await this.getAvailableAddress(addresses);
      
      if(!availableAddress) {
        throw new Error('Provided addresses are not available');
      }

      this.workerAddress = availableAddress;
      await this.changeWorker();
      super.init.apply(this, arguments);
    }

    /**
     * Deinitialize the client
     * 
     * @async
     */
    async deinit() {
      await this.deinitServices();
      super.deinit.apply(this, arguments);
    }

    /**
     * Prepare the services
     * 
     * @async
     */
    async prepareServices() {
      this.logger = new this.LoggerTransport(this, this.options.logger);
      this.options.task && (this.task = new this.TaskTransport(this, this.options.task));

      if(!this.task) {
        return;        
      }

      if(this.options.task.workerChangeInterval) {
        await this.task.add('workerChange', this.options.task.workerChangeInterval, () => this.changeWorker());
      }
    }

    /**
     * Initialize the services
     * 
     * @async
     */
    async initServices() {
      await this.logger.init();
      this.task && await this.task.init();
    }

    /**
     * Deinitialize the services
     * 
     * @async
     */
    async deinitServices() {
      this.task && await this.task.deinit();
      await this.logger.deinit();
    }

    /**
     * Get an available address from the list
     * 
     * @async
     * @param {string[]} addresses
     * @returns {string}
     */
    async getAvailableAddress(addresses) {
      let availableAddress;

      for(let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        
        try {
          await fetch(`${this.getRequestProtocol()}://${address}/ping`, this.createDefaultRequestOptions({ 
            method: 'GET',
            timeout: this.options.request.pingTimeout
          }));
          availableAddress = address;
          break;
        }
        catch(err) {
          this.logger.warn(err.stack);
        }
      }

      return availableAddress;
    }

    /**
     * Change the worker address
     * 
     * @async
     */
    async changeWorker() {
      const lastAddress = this.workerAddress;

      const address = (await this.request('get-available-node', {
        useInitialAddress: true
      })).address;

      if(address == lastAddress) {
        return;
      }

      try {
        await fetch(`${this.getRequestProtocol()}://${address}/ping`, this.createDefaultRequestOptions({ 
          method: 'GET',
          timeout: this.options.request.pingTimeout
        }));
        this.workerAddress = address;
      }
      catch(err) {
        this.logger.warn(err.stack);
        this.workerAddress = lastAddress;
      }
    }

    /**
     * Make a request to the api
     * 
     * @async
     * @param {string} endpoint
     * @param {object} [options]
     * @returns {object}
     */
    async request(endpoint, options = {}) {
      options = merge(this.createDefaultRequestOptions(), options);
      let body = options.formData || options.body || {};
      body.timeout = options.timeout;
      body.timestamp = Date.now();

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
        options.body = JSON.stringify(body);
      } 
      
      options.url = this.createRequestUrl(endpoint, { useInitialAddress: options.useInitialAddress });
      const start = Date.now();

      try {        
        const result = await fetch(options.url, options);    
        this.logger.info(`Request to "${options.url}":`, ms(Date.now() - start));    
        const body = await result.json();

        if(result.ok) {
          return body;
        }

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
     * Create a api request url
     * 
     * @param {string} endpoint 
     * @param {object} options 
     */
    createRequestUrl(endpoint, options = {}) {
      const query = options.query? qs.stringify(options.query): null;
      const address = options.useInitialAddress? this.address: this.workerAddress;
      let url = `${this.getRequestProtocol()}://${address}/client/${endpoint}`;
      query && (url += '?' + query);
      return url;
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
        timeout: this.options.request.clientTimeout,
        headers: {
          'network-secret-key': this.options.secretKey          
        }
      };

      if(options.timeout) {
        options.timeout = utils.getMs(options.timeout);
      }

      if(typeof this.options.https == 'object' && this.options.https.ca) {
        options.agent = options.agent || new https.Agent();
        options.agent.options.ca = this.options.https.ca;
      }

      return merge({}, defaults, options);
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
     * Prepare the options
     */
    prepareOptions() {    
      this.options.request.clientTimeout = utils.getMs(this.options.request.clientTimeout);     
    }

    /**
     * Get a request protocol
     * 
     * @returns {string}
     */
    getRequestProtocol() {
      return this.options.https? 'https': 'http';
    }

    /**
     * Check the environment
     */
    envFilter(isBrowser, name) {
      const isBrowserEnv = utils.isBrowserEnv();

      if(isBrowser && !isBrowserEnv) {
        throw new Error(`You can't use "${name}" method in the nodejs environment`);
      }

      if(!isBrowser && isBrowserEnv) {
        throw new Error(`You can't use "${name}" method in the browser environment`);
      }
    }
  }
};