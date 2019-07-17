const Task = require('../task')();
const utils = require('../../../utils');

module.exports = (Parent) => {
  /**
   * Interval tasks transport
   */
  return class TaskInterval extends (Parent || Task) {
    /**
     * @see Task.prototype.add
     */
    async add(name, interval, fn, options) {
      return super.add(name, utils.getMs(interval), fn, options);
    }
    
    /**
     * @see Task.prototype.start
     */
    async start(task) {
      await super.start(task);
      const obj = setInterval(() => this.run(task), task.interval);
      task.intervalObject = obj;
    }

    /**
     * @see Task.prototype.stop
     */
    async stop(task) {
      clearInterval(task.intervalObject);
      await super.stop(task);
    }
  }  
};