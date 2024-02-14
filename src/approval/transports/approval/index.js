import Service from "../../../service.js";
import utils from "../../../utils.js";
import * as errors from "../../../errors.js";

export default (Parent) => {
  /**
   * Approval transport
   */
  return class Approval extends (Parent || Service) {
    /**
     * @param {object} options
     */
    constructor(options = {}) {
      super(...arguments);
      Object.assign(this, {
        approversCount: 'auto',
        decisionLevel: '66.6%',
        period: '5m'
      }, options);
    }

    /**
     * @see Approval.prototype.init
     */
    async init() {
      this.period = utils.getMs(this.period);
      super.init.apply(this, arguments);
    }

    /**
     * Test the approval client info
     *
     * @param {*} info
     */
    clientInfoTest(info) {
      utils.validateSchema(this.getClientInfoSchema(), info);
    }

    /**
     * Test the approval time
     *
     * @param {number} time
     */
    async startTimeTest(time) {
      if (typeof time != 'number' || isNaN(time)) {
        throw new errors.WorkError(`Approval time must be an integer`, 'ERR_SPREADABLE_WRONG_APPROVAL_TIME');
      }

      const closest = utils.getClosestPeriodTime(Date.now(), this.period);

      if (time !== closest && time !== closest - this.period) {
        throw new errors.WorkError(`Incorrect approval time`, 'ERR_SPREADABLE_WRONG_APPROVAL_TIME');
      }
    }

    /**
     * Calculate the approvers count
     *
     * @returns {integer}
     */
    async calculateApproversCount() {
      return await this.node.getValueGivenNetworkSize(this.approversCount);
    }

    /**
     * Calculate the decision level
     *
     * @async
     * @returns {number}
     */
    async calculateDescisionLevel() {
      let level = this.decisionLevel;
      const count = await this.calculateApproversCount();
      
      if (typeof level == 'string' && level.match('%')) {
        level = Math.ceil(count * parseFloat(level) / 100);
      }

      return level;
    }

    /**
     * Test the approver decisions count
     *
     * @async
     * @param {number} count
     */
    async approversDecisionCountTest(count) {
      const decistionLevel = await this.calculateDescisionLevel(count);

      if (count < decistionLevel) {
        throw new errors.WorkError('Not enough approvers to make a decision', 'ERR_SPREADABLE_NOT_ENOUGH_APPROVER_DECISIONS');
      }
    }

    /**
     * Create the info
     *
     * @async
     * @param {object} approver
     * @returns {object}
     */
    async createInfo() {
      throw new Error('Method "createInfo" is required for approval transport');
    }

    /**
     * Create the question
     *
     * @async
     * @param {array} data
     * @param {*} info
     * @param {string} clientIp
     * @returns {object}
     */
    async createQuestion() {
      throw new Error('Method "createQuestion" is required for approval transport');
    }

    /**
     * Check the answer
     *
     * @async
     * @param {object} approver
     * @param {string} answer
     * @param {string[]} approvers
     * @returns {boolean}
     */
    async checkAnswer() {
      throw new Error('Method "checkAnswer" is required for approval transport');
    }

    /**
     * Get the client info schema
     *
     * @returns {object}
     */
    getClientInfoSchema() {
      throw new Error('Method "getClientInfoSchema" is required for approval transport');
    }

    /**
     * Get the client answer schema
     *
     * @returns {object}
     */
    getClientAnswerSchema() {
      throw new Error('Method "getClientAnswerSchema" is required for approval transport');
    }

    /**
     * Get the approver info schema
     *
     * @returns {object}
     */
    getApproverInfoSchema() {
      throw new Error('Method "getApproverInfoSchema" is required for approval transport');
    }
  };
};
