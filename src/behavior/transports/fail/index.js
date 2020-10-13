const Behavior = require('../behavior')();
const utils = require('../../../utils');

module.exports = (Parent) => {
  /**
   * Fail behavior transport
   */
  return class BehaviorlFail extends (Parent || Behavior) {
    /**
     * @param {object} [options]
     */
    constructor(options) {
      super(...arguments);
      Object.assign(this, {
        ban: true,
        banDelay: 0,
        banLifetime: '27d',
        failLifetime: 'auto',
        failSuspicionLevel: 20
      }, options);
    }

    /**
     * Create a step
     * 
     * @param {boolean} add
     * @param {number|boolean[]} step
     * @param {object} [options]
     * @param {boolean} [options.exp]
     * @returns {number|function}
     */
    createStep(add, step = 1, options = {}) {
      if(Array.isArray(step)) {
        step = step.map(s => !!s).reduce((p, c, i, a) => !c? (p += 1 / a.length): p, 0);
      }

      if(typeof step == 'function') {
        return step;
      }

      if(!options.exp) {
        return step;
      }

      return behavior => {
        if(!behavior) {
          return step;
        }

        const coef = Math.sqrt(behavior.balance);
        return add? step * coef: step / coef;
      };
    }

    /**
     * @see Behavior.prototype.init
     */
    async init() {
      this.banDelay = utils.getMs(this.banDelay);
      this.banLifetime = utils.getMs(this.banLifetime);
      this.failLifetime = utils.getMs(this.failLifetime);
      super.init.apply(this, arguments);
    }

    /**
     * Get the fail
     * 
     * @param {string} address
     * @returns {object}
     */
    async get(address) {
      return this.node.db.getBehaviorFail(this.action, address);
    }
    
    /**
     * Add the fail
     * 
     * @see BehaviorlFail.prototype.createStep
     * @returns {object}
     */
    async add(address, step, options) {
      return this.node.db.addBehaviorFail(this.name, address, this.createStep(true, step, options));
    }

    /**
     * Subtract the fail
     * 
     * @see BehaviorlFail.prototype.createStep
     * @returns {object}
     */
    async sub(address, step, options) {
      return this.node.db.subBehaviorFail(this.name, address, this.createStep(false, step, options));
    }
  }
};