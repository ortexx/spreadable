import task from "../task/index.js";
import { CronJob } from "cron";
const Task = task();

export default (Parent) => {
  /**
   * Cron tasks transport
   */
  return class TaskCron extends (Parent || Task) {

    /**
     * @see Task.prototype.start
     */
    async start(task) {
      await super.start(task);
      task.cronTask = new CronJob(task.interval, () => this.run(task));
      task.cronTask.start();
    }

    /**
     * @see Task.prototype.stop
     */
    async stop(task) {
      task.cronTask.stop();
      await super.stop(task);
    }
  };
};
