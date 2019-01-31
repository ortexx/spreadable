const merge = require('lodash/merge');
const fetch = require('node-fetch');
const FormData = require('form-data');
const https = require('https');
const qs = require('querystring');
const utils = require('./utils');
const errors = require('./errors');
const prettyMs = require('pretty-ms');
const LoggerConsole = require('./logger/transports/console')();
const TaskInterval = require('./task/transports/interval')();

module.exports = () => {
  /**
   * Class to manage client requests to the network
   */
  return class Client {
    static get LoggerTransport () { return LoggerConsole }
    static get TaskTransport () { return TaskInterval }

    /**
     * @param {object} options
     * @param {string} options.address
     */
    constructor(options = {}) {
      if(!options.address) {
        throw new Error('You must pass the node address in "ip:port" format');
      }

      this.options = merge({
        request: {
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

      this.prepareOptions();
      this.LoggerTransport = this.constructor.LoggerTransport;
      this.TaskTransport = this.constructor.TaskTransport;
      this.address = options.address;
      this.__initialized = false;
    }

    /**
     * Initialize the client
     * 
     * @aync
     */
    async init() {
      await this.prepareServices();
      await this.initServices();
      this.workAddress = this.address;
      await this.changeWorker();
      this.__initialized = true;
    }

    /**
     * Deinitialize the client
     * 
     * @aync
     */
    async deinit() {
      this.initializationFilter();
      await this.deinitServices();
      this.__initialized = false;
    }

     /**
     * Prepare the sevices
     * 
     * @async
     */
    async prepareServices() {
      this.logger = new this.LoggerTransport(this, merge({}, this.options.logger));
      this.options.task && (this.task = new this.TaskTransport(this, merge({}, this.options.task)));

      if(this.task) {
        this.task.add('workerChange', this.options.task.workerChangeInterval, () => this.changeWorker());
      }
      else {
        this.logger.warn('You have to enable tasks if you use the client in production');
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
     * Denitialize the services
     * 
     * @async
     */
    async deinitServices() {
      this.task && await this.task.deinit();
      await this.logger.deinit();
    }

    /**
     * Change the worker address
     */
    async changeWorker() {
      this.workAddress = (await this.request('get-available-node', {
        useInitialAddress: true
      })).address;
    }

    /**
     * Make a request to api
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
        this.logger.info(`Request to "${options.url}":`, prettyMs(Date.now() - start));    
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
     * Create api request url
     * 
     * @param {string} endpoint 
     * @param {object} options 
     */
    createRequestUrl(endpoint, options = {}) {
      const query = options.query? qs.stringify(options.query): null;
      const address = options.useInitialAddress? this.address: this.workAddress;
      let url = `${this.options.https? 'https': 'http'}://${address}/client/${endpoint}`;
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
     * Prepare the options
     */
    prepareOptions() {    
      this.options.request.clientTimeout = utils.getMs(this.options.request.clientTimeout);     
    }

    /**
     * Check the client is initialized
     * 
     * @returns {boolean}
     */
    isInitialized() {
      return this.__initialized;
    }

    /**
     * Check the client is initialized
     */
    initializationFilter() {
      if(!this.isInitialized()) {
        throw new Error('Client must be initialized at first');
      }
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