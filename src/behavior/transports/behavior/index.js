const Service = require('../../../service')();

module.exports = (Parent) => {
  /**
   * Behavior transport
   */
  return class Behavior extends (Parent || Service) {
    /**
     * @param {object} [options]
     */
    constructor(options = {}) {
      super(...arguments);
      Object.assign(this, options);
    }
  }
};