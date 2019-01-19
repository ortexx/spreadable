const Logger = require('../logger')();
const chalk = require('chalk');

module.exports = (Parent) => {
  /**
   * logger transport interface
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
        console[level].apply(console[level], args.map(arg => chalk[this.colors[level]](arg)));
      }
    }
  }
};