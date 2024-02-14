import behavior from "../behavior/index.js";
import utils from "../../../utils.js";
const Behavior = behavior();

export default (Parent) => {
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
        banLifetime: '18d',
        banDelay: 'auto',
        failLifetime: 'auto',
        failSuspicionLevel: 30
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
      options = Object.assign({ exp: this.exp }, options);

      if (Array.isArray(step)) {
        step = step.map(s => !!s).reduce((p, c, i, a) => !c ? (p += 1 / a.length) : p, 0);
      }

      if (typeof step == 'function') {
        return step;
      }

      if (!options.exp) {
        return step;
      }

      return behavior => {
        if (!behavior) {
          return step;
        }
        
        const coef = Math.sqrt(add ? behavior.up : behavior.down) || 1;
        return add ? step * coef : step / coef;
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
      return await this.node.db.getBehaviorFail(this.action, address);
    }

    /**
     * Add the fail
     *
     * @see BehaviorlFail.prototype.createStep
     * @returns {object}
     */
    async add(address, step, options) {
      const behavior = await this.node.db.addBehaviorFail(this.name, address, this.createStep(true, step, options));
      this.node.logger.warn(`Behavior fail "${this.name}" for "${this.node.address}" as ${JSON.stringify(behavior, null, 2)}`);
      return behavior;
    }

    /**
     * Subtract the fail
     *
     * @see BehaviorlFail.prototype.createStep
     * @returns {object}
     */
    async sub(address, step, options) {
      return await this.node.db.subBehaviorFail(this.name, address, this.createStep(false, step, options));
    }
  };
};
