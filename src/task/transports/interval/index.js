const Task = require('../task')();

module.exports = (Parent) => {
  /**
   * Interval tasks transport
   */
  return class TaskInterval extends (Parent || Task) {
    /**
     * @see Task.prototype.start
     */
    async start(task) {
      const start= super.start;
      const self = this;

      const obj = setInterval(() => {
        start.call(self, task);
      }, task.interval)

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