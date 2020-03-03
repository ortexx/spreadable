const Service = require('../../../service')();

module.exports = (Parent) => {
  /**
   * Behavior transport
   */
  return class Behavior extends (Parent || Service) {
    /**
     * @param {Node} node 
     * @param {object} [options]
     */
    constructor(node, options = {}) {
      super(...arguments);
      this.node = node; 
      Object.assign(this, options);
    }
  }
};