import logger from "../logger/index.js";
import chalk from "chalk";
import utils from "../../../utils.js";

const Logger = logger();

export default (Parent) => {
  /**
   * Console logger transport
   */
  return class LoggerConsole extends (Parent || Logger) {
    constructor() {
      super(...arguments);
      this.colors = {
        info: 'white',
        warn: 'yellow',
        error: 'red'
      };
    }

    /**
     * @see Logger.prototype.log
     */
    async log(level, message) {
      if (!this.isLevelActive(level)) {
        return;
      }
      
      //eslint-disable-next-line no-console
      (console[level] || console.log)(utils.isBrowserEnv() ? message : chalk[this.colors[level]](message));
    }
  };
};
