import task from "../task/index.js";
import utils from "../../../utils.js";
const Task = task();

export default (Parent) => {
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
  };
};
