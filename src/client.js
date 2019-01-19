const _ = require('lodash');
const request = require('request');
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

      this.options = _.merge({
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
      this.logger = new this.LoggerTransport(this, _.merge({}, this.options.logger));
      this.options.task && (this.task = new this.TaskTransport(this, _.merge({}, this.options.task)));

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
      options = _.merge(this.createDefaultRequestOptions(), options);
      let body = options.formData;
      let bodyType = 'formData';

      if(!body) {
        bodyType = 'body';
        body = options.body || {};
      }

      body.timeout = options.timeout;
      body.timestamp = Date.now(); 
      options[bodyType] = body;
      options.url = this.createRequestUrl(endpoint, { useInitialAddress: options.useInitialAddress });
      
      return await new Promise((resolve, reject) => {
        const start = Date.now();        

        const req = request(options, (err, res, body) => {
          this.logger.info(`Request to "${options.url}":`, prettyMs(Date.now() - start));
          
          if(err) {
            utils.isRequestTimeoutError(err) && (err = utils.createRequestTimeoutError());
            err.requestOptions = options;
            return reject(err);
          }

          if(res.statusCode < 400) {
            return resolve(body);          
          }

          if(!body || !body.code) {
            return reject(new Error(body.message));
          }
          
          err = new errors.WorkError(body.message, body.code);
          return reject(err);
        });

        options.getRequest && options.getRequest(req);
      });
    }

    /**
     * Create api request url
     * 
     * @param {string} endpoint 
     * @param {object} options 
     */
    createRequestUrl(endpoint, options = {}) {
      const address = options.useInitialAddress? this.address: this.workAddress;
      return `${this.options.https? 'https': 'http'}://${address}/client/${endpoint}`;
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
        json: true,
        headers: {
          'network-secret-key': this.options.secretKey
        }
      };

      if(options.timeout) {
        options.timeout = utils.getMs(options.timeout);
      }

      if(typeof this.options.https == 'object' && this.options.https.ca) {
        defaults.ca = this.options.https.ca;
      }

      return _.merge({}, defaults, options);
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
  }
};