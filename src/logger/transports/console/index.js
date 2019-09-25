const Logger = require('../logger')();
const chalk = require('chalk');
const utils = require('../../../utils');

module.exports = (Parent) => {
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
    async log(level, ...args) {
      if(this.isLevelActive(level)) {   
        //eslint-disable-next-line no-console
        console[level].apply(console[level], utils.isBrowserEnv()? args: args.map(arg => {
          arg && typeof arg == 'object' && (arg = JSON.stringify(arg));
          return chalk[this.colors[level]](arg);
        }));
      }
    }
  }
};