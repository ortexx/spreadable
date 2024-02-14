import merge from "lodash-es/merge.js";
import Service from "../../../service.js";

export default (Parent) => {
  /**
   * Tasks transport
   */
  return class Task extends (Parent || Service) {
    /**
     * @param {object} options
     */
    constructor(options = {}) {
      super(...arguments);
      this.options = merge({
        showCompletionLogs: true,
        showFailLogs: true
      }, options);
      this.tasks = {};
    }

    /**
     * Add the task
     */
    async add(name, interval, fn, options) {
      const task = merge({
        interval,
        fn,
        name,
      }, options);
      task.isStopped === undefined && (task.isStopped = true);
      this.tasks[name] = task;

      if (!task.isStopped) {
        await this.stop(task);
        await this.start(task);
      }

      return task;
    }

    /**
     * Get the task
     *
     * @returns {object}
     */
    async get(name) {
      return this.tasks[name] || null;
    }

    /**
     * Remove the task
     */
    async remove(name) {
      const task = this.tasks[name];

      if (!task) {
        return;
      }

      !task.isStopped && await this.stop(task);
      delete this.tasks[name];
    }

    /**
     * Initialize the tasks
     *
     * @async
     */
    async init() {
      this.startAll();
      await super.init.apply(this, arguments);
    }

    /**
     * Deinitialize the tasks
     *
     * @async
     */
    async deinit() {
      this.stopAll();
      await super.deinit.apply(this, arguments);
    }

    /**
     * Start all tasks
     */
    async startAll() {
      for (let key in this.tasks) {
        await this.start(this.tasks[key]);
      }
    }

    /**
     * Stop all tasks
     *
     * @async
     */
    async stopAll() {
      for (let key in this.tasks) {
        await this.stop(this.tasks[key]);
      }
    }

    /**
     * Run the task callback
     *
     * @async
     * @param {object} task
     * @param {number} task.interval
     * @param {function} task.fn
     */
    async run(task) {
      if (task.isStopped) {
        this.options.showFailLogs && this.node.logger.warn(`Task "${task.name}" should be started at first`);
        return;
      }

      if (task.isRun) {
        this.options.showFailLogs && this.node.logger.warn(`Task "${task.name}" has blocking operations`);
        return;
      }

      task.isRun = true;

      try {
        await task.fn();
        this.options.showCompletionLogs && this.node.logger.info(`Task "${task.name}" has been completed`);
      }
      catch (err) {
        this.options.showFailLogs && this.node.logger.error(`Task "${task.name}", ${err.stack}`);
      }
      
      task.isRun = false;
    }

    /**
     * Start the task
     *
     * @async
     * @param {object} task
     * @param {number} task.interval
     * @param {function} task.fn
     */
    async start(task) {
      task.isStopped = false;
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
  };
};
