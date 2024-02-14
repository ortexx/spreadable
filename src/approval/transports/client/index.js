import approval from "../approval/index.js";
import utils from "../../../utils.js";
import schema from "../../../schema.js";
const Approval = approval();

export default (Parent) => {
  /**
   * Client approval transport
   */
  return class ApprovalClient extends (Parent || Approval) {
    /**
     * @see Approval.prototype.createInfo
     */
    async createInfo(approver) {
      return {
        info: approver.clientIp,
        answer: approver.clientIp
      };
    }

    /**
     * @see Approval.prototype.createQuestion
     */
    async createQuestion(data, info, clientIp) {
      return clientIp;
    }

    /**
     * @see Approval.prototype.checkAnswer
     */
    async checkAnswer(approver, answer) {
      return utils.isIpEqual(approver.answer, answer);
    }

    /**
     * @see Approval.prototype.getClientInfoSchema
     */
    getClientInfoSchema() {
      return {
        type: 'undefined'
      };
    }

    /**
     * @see Approval.prototype.getClientAnswerSchema
     */
    getClientAnswerSchema() {
      return schema.getClientIp();
    }

    /**
     * @see Approval.prototype.getApproverInfoSchema
     */
    getApproverInfoSchema() {
      return schema.getClientIp();
    }
  };
};
