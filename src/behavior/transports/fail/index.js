const Behavior = require('../behavior')();
const utils = require('../../../utils');

module.exports = (Parent) => {
  /**
   * Fail behavior transport
   */
  return class BehaviorlFail extends (Parent || Behavior) {
    /**
     * @param {Node} node 
     * @param {object} [options]
     */
    constructor(node, options) {
      super(...arguments);
      Object.assign(this, {
        ban: true,
        banLifetime: '27d',
        failSuspicionLevel: 10
      }, options);
    }

    /**
     * @see Behavior.prototype.init
     */
    async init() {
      typeof this.banLifetime == 'string' && (this.banLifetime = utils.getMs(this.banLifetime));
      super.init.apply(this, arguments);
    }
  }
};