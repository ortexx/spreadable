import merge from "lodash-es/merge.js";
import shuffle from "lodash-es/shuffle.js";
import FormData from "form-data";
import https from "https";
import fetch from "node-fetch";
import qs from "querystring";
import utils from "./utils.js";
import * as errors from "./errors.js";
import ms from "ms";
import loggerConsole from "./logger/transports/console/index.js";
import taskInterval from "./task/transports/interval/index.js";
import Service from "./service.js";
import pack from "../package.json" with { type: "json" };

const LoggerConsole = loggerConsole();
const TaskInterval = taskInterval();

export default (Parent) => {
  /**
   * Class to manage client requests to the network
   */
  return class Client extends (Parent || Service) {
    static get version() { return pack.version; }
    static get codename() { return pack.name; }
    static get utils() { return utils; }
    static get errors() { return errors; }
    static get LoggerTransport() { return LoggerConsole; }
    static get TaskTransport() { return TaskInterval; }

    /**
     * Get the auth cookie value
     *
     * @returns {object}
     */
    static getAuthCookieValue() {
      if (typeof location != 'object' || !location.hostname) {
        return null;
      }

      const address = this.getPageAddress();
      const name = `spreadableNetworkAuth[${address}]`;
      const value = "; " + document.cookie;
      const parts = value.split("; " + name + "=");
      const res = parts.length == 2 && parts.pop().split(";").shift();
      return res ? JSON.parse(atob(res)) : null;
    }

    /**
     * Get the page address
     *
     * @returns {string}
     */
    static getPageAddress() {
      if (typeof location != 'object' || !location.hostname) {
        return '';
      }
      return `${location.hostname}:${location.port || (this.getPageProtocol() == 'https' ? 443 : 80)}`;
    }

    /**
     * Get the page protocol
     *
     * @returns {string}
     */
    static getPageProtocol() {
      if (typeof location != 'object' || !location.protocol) {
        return '';
      }
      return location.protocol.split(':')[0];
    }

    /**
     * @param {object} options
     * @param {string|string[]} options.address
     */
    constructor(options = {}) {
      super(...arguments);
      this.options = merge({
        request: {
          pingTimeout: '1s',
          clientTimeout: '10s',
          approvalQuestionTimeout: '20s',
          ignoreVersion: false
        },
        auth: this.constructor.getAuthCookieValue(),
        address: this.constructor.getPageAddress(),
        https: this.constructor.getPageProtocol() == 'https',
        logger: {
          level: 'info'
        },
        task: {
          workerChangeInterval: '30s'
        }
      }, options);
      !this.options.logger && (this.options.logger = { level: false });
      typeof this.options.logger == 'string' && (this.options.logger = { level: this.options.logger });
      this.LoggerTransport = this.constructor.LoggerTransport;
      this.TaskTransport = this.constructor.TaskTransport;
      this.address = this.options.address;
      this.__isMasterService = true;
      this.prepareOptions();
    }

    /**
     * Initialize the client
     *
     * @async
     */
    async init() {
      if (!this.address) {
        throw new Error('You must pass the node address');
      }
      
      await this.prepareServices();
      await super.init.apply(this, arguments);
      let address = this.address;
      Array.isArray(address) && (address = shuffle(address));
      this.availableAddress = await this.getAvailableAddress(address);

      if (!this.availableAddress) {
        throw new Error('Provided addresses are not available');
      }

      this.workerAddress = this.availableAddress;
    }

    /**
     * Prepare the services
     *
     * @async
     */
    async prepareServices() {
      await this.prepareLogger();
      await this.prepareTask();
    }

    /**
     * Prepare the logger service
     *
     * @async
     */
    async prepareLogger() {
      this.logger = await this.addService('logger', new this.LoggerTransport(this.options.logger));
    }

    /**
     * Prepare the task service
     *
     * @async
     */
    async prepareTask() {
      this.options.task && (this.task = await this.addService('task', new this.TaskTransport(this.options.task)));

      if (!this.task) {
        return;
      }

      if (this.options.task.workerChangeInterval) {
        await this.task.add('workerChange', this.options.task.workerChangeInterval, () => this.changeWorker());
      }
    }

    /**
     * Get an available address from the list
     *
     * @async
     * @param {string|string[]} addresses
     * @returns {string}
     */
    async getAvailableAddress(addresses) {
      !Array.isArray(addresses) && (addresses = [addresses]);
      let availableAddress;

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];

        try {
          await fetch(`${this.getRequestProtocol()}://${address}/ping`, this.createDefaultRequestOptions({
            method: 'GET',
            timeout: this.options.request.pingTimeout
          }));
          availableAddress = address;
          break;
        }
        catch (err) {
          this.logger.warn(err.stack);
        }
      }

      return availableAddress || null;
    }

    /**
     * Change the worker address
     *
     * @async
     */
    async changeWorker() {
      const lastAddress = this.workerAddress;
      const result = await this.request('get-available-node', { address: this.availableAddress });
      const address = result.address;
     
      if (address == lastAddress) {
        return;
      }

      try {
        await fetch(`${this.getRequestProtocol()}://${address}/ping`, this.createDefaultRequestOptions({
          method: 'GET',
          timeout: this.options.request.pingTimeout
        }));
        this.workerAddress = address;
      }
      catch (err) {
        this.logger.warn(err.stack);
        this.workerAddress = lastAddress;
      }
    }

    /**
     * Get the approval question
     *
     * @param {string} action
     * @param {object} [info]
     * @param {object} [options]
     * @returns {object}
     */
    async getApprovalQuestion(action, info, options = {}) {
      const timeout = options.timeout || this.options.request.approvalQuestionTimeout;
      const timer = this.createRequestTimer(timeout);
      const result = await this.request('request-approval-key', Object.assign({}, options, {
        body: { action },
        timeout: timer()
      }));
      const approvers = result.approvers;
      const key = result.key;
      const startedAt = result.startedAt;
      const clientIp = result.clientIp;
      const confirmedAddresses = [];
      const targets = approvers.map(address => ({ address }));
      const results = await this.requestGroup(targets, 'add-approval-info', Object.assign({}, options, {
        includeErrors: true,
        timeout: timer(this.options.request.clientTimeout),
        body: {
          action,
          key,
          info,
          startedAt
        }
      }));

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        
        if (result instanceof Error) {
          continue;
        }

        confirmedAddresses.push(targets[i].address);
      }

      const res = await this.request('request-approval-question', Object.assign({}, options, {
        body: {
          action,
          key,
          info,
          confirmedAddresses
        },
        timeout: timer()
      }));
      return {
        action,
        key,
        question: res.question,
        approvers: confirmedAddresses,
        startedAt,
        clientIp
      };
    }

    /**
     * Make a group request
     *
     * @async
     * @param {array} arr
     * @param {string} action
     * @param {object} [options]
     * @returns {object}
     */
    async requestGroup(arr, action, options = {}) {
      const requests = [];
      
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const address = item.address;
        requests.push(new Promise(resolve => {
          this.request(action, merge({ address }, options, item.options))
            .then(resolve)
            .catch(resolve);
        }));
      }

      let results = await Promise.all(requests);
      !options.includeErrors && (results = results.filter(r => !(r instanceof Error)));
      return results;
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
      
      if (options.approvalInfo) {
        const approvalInfo = options.approvalInfo;
        delete approvalInfo.question;
        
        if (!Object.prototype.hasOwnProperty.call(approvalInfo, 'answer')) {
          throw new Error('Request "approvalInfo" option must include "answer" property');
        }

        body.approvalInfo = options.formData ? JSON.stringify(approvalInfo) : approvalInfo;
      }

      if (options.formData) {
        const form = new FormData();
        
        for (let key in body) {
          let val = body[key];
          
          if (typeof val == 'object') {
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
            
      if(options.timeout && !options.signal) {
        options.signal = AbortSignal.timeout(Math.floor(options.timeout));
      }

      options.url = this.createRequestUrl(endpoint, options);
      const start = Date.now();
      let response = {};

      try {
        response = await fetch(options.url, options);    
        this.logger.info(`Request to "${options.url}": ${ms(Date.now() - start)}`);
        
        if (response.ok) {
          return options.getFullResponse ? response : await response.json();
        }

        const type = (response.headers.get('content-type') || '').match('application/json') ? 'json' : 'text';
        const body = await response[type]();
        
        if (!body || typeof body != 'object') {
          throw new Error(body || 'Unknown error');
        }

        if (!body.code) {
          throw new Error(body.message || body);
        }

        throw new errors.WorkError(body.message, body.code);
      }
      catch (err) {
        options.timeout && err.type == 'aborted' && (err.type = 'request-timeout');        
        //eslint-disable-next-line no-ex-assign
        utils.isRequestTimeoutError(err) && (err = utils.createRequestTimeoutError());
        err.response = response;
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
      const query = options.query ? qs.stringify(options.query) : null;
      const address = options.address || this.workerAddress;
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
        timeout: this.options.request.clientTimeout
      };

      if(!this.options.request.ignoreVersion) {
        defaults.headers = {
          'client-version': this.getVersion()
        }
      }

      if (this.options.auth) {
        const username = this.options.auth.username;
        const password = this.options.auth.password;
        let header = 'Basic ';

        if (typeof Buffer == 'function') {
          header += Buffer.from(username + ":" + password).toString('base64');
        }
        else {
          header += btoa(username + ":" + password);
        }

        defaults.headers.authorization = header;
      }

      if (options.timeout) {
        options.timeout = utils.getMs(options.timeout);
      }

      if (typeof this.options.https == 'object' && this.options.https.ca) {
        if (!https.Agent) {
          options.agent = options.agent || {};
          options.agent.ca = this.options.https.ca;
        }
        else {
          options.agent = options.agent || new https.Agent();
          options.agent.options.ca = this.options.https.ca;
        }
      }

      return merge({}, defaults, options);
    }

    /**
     * Create a request timer
     *
     * @param {number} timeout
     * @param {object} [options]
     * @returns {function}
     */
    createRequestTimer(timeout, options = {}) {
      options = Object.assign({
        min: this.options.request.pingTimeout
      }, options);
      return utils.getRequestTimer(timeout, options);
    }

    /**
     * Prepare the options
     */
    prepareOptions() {
      this.options.request.pingTimeout = utils.getMs(this.options.request.pingTimeout);
      this.options.request.clientTimeout = utils.getMs(this.options.request.clientTimeout);
      this.options.request.approvalQuestionTimeout = utils.getMs(this.options.request.approvalQuestionTimeout);
    }

    /**
     * Get the request protocol
     *
     * @returns {string}
     */
    getRequestProtocol() {
      return this.options.https ? 'https' : 'http';
    }

    /**
     * Check the environment
     */
    envTest(isBrowser, name) {
      const isBrowserEnv = utils.isBrowserEnv();
      
      if (isBrowser && !isBrowserEnv) {
        throw new Error(`You can't use "${name}" method in the nodejs environment`);
      }

      if (!isBrowser && isBrowserEnv) {
        throw new Error(`You can't use "${name}" method in the browser environment`);
      }
    }
  };
};
