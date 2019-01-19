const Task = require('../task')();
const CronJob = require('cron').CronJob;

module.exports = (Parent) => {
  /**
   * Cron tasks transport
   */
  return class TaskCron extends (Parent || Task) {
    /**
     * @see Task.prototype.start
     */
    async start(task) {
      const start = super.start;
      const self = this;
      task.cronTask = new CronJob(task.interval, () => start.call(self, task));
      task.cronTask.start();
    }

    /**
     * @see Task.prototype.stop
     */
    async stop(task) {
      task.cronTask.stop();
      await super.stop(task);
    }
  }  
};