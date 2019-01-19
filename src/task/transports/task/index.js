const _ = require('lodash');
const utils = require('../../../utils');

module.exports = () => {
  /**
   * The main tasks transport
   */
  return class Task {
    /**
     * @param {Node} node 
     * @param {object} options
     */
    constructor(node, options = {}) {
      this.node = node;

      this.options = _.merge({
        showCompletionLogs: true,
        showFailLogs: true
      }, options);

      this.blocked = {};
      this.tasks = {};
    }    

    /**
     * Initialize the tasks
     * 
     * @async
     */
    async init() {
      this.startAll(); 
      this.__initialized = true;
      this.node.logger.info(`Tasks have been initialized`);   
    }

    /**
     * Denitialize the tasks
     * 
     * @async
     */
    async deinit() {
      this.stopAll();
      this.__initialized = false;
      this.node.logger.info(`Tasks have been deinitialized`);   
    }

    /**
     * Destroy the tasks
     * 
     * @async
     */
    async destroy() {
      await this.deinit();
      this.node.logger.info(`Tasks have been destroyed`);
    }

    /**
     * Block the function
     * 
     * @param {string} name - task name 
     * @param {function} fn 
     */
    async blockFn(name, fn) {
      if(this.blocked[name]) {
        return;
      }

      this.blocked[name] = fn;
      await fn();
      delete this.blocked[name];
    }

    /**
     * Add the task
     */
    async add(name, interval, fn, options) {
      this.tasks[name] = _.merge({ interval: utils.getMs(interval), fn, name }, options);
    }

    /**
     * Start all tasks
     */
    async startAll() {
      for(let key in this.tasks) {
        await this.start(this.tasks[key]);
      }
    }

    /**
     * Stop all tasks
     * 
     * @async
     */
    async stopAll() {
      for(let key in this.tasks) {
        await this.stop(this.tasks[key])
      }
    }

    /**
     * Start the task
     * 
     * @async
     * @param {object} task
     * @param {number} task.interval
     * @param {boolean} task.block 
     * @param {function} task.fn
     */
    async start(task) {
      try {
        task.isStopped = false;
        task.block? await this.blockFn(task.name, task.fn): await task.fn();        
        this.options.showCompletionLogs && this.node.logger.info(`Task "${task.name}" has been completed`);
      }
      catch(err) {
        this.options.showFailLogs && this.node.logger.error(`Task "${task.name}",`, err.stack);
      }
    }

    /**
    * Stop the task
    * 
    * @async
    * @param {object} task
    */
    async stop(task) {
      task.isStopped = true;
    }
  }
};