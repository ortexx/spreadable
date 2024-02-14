import * as controllers from "./controllers.js";

export default [
  /**
   * Register the address
   *
   * @api {post} /api/node/register
   * @apiParam {string} target
   * @apiSuccess {object} - { size, chain: [...] }
   */
  {
    name: 'register',
    method: 'post',
    url: '/register',
    fn: controllers.register
  },

  /**
   * Get the node structure
   *
   * @api {post} /api/node/structure
   * @apiSuccess {object} - { slaves: [...], masters: [...], backlink: {...} }
   */
  {
    name: 'structure',
    method: 'post',
    url: '/structure',
    fn: controllers.structure
  },

  /**
   * Get an interview summary
   *
   * @api {post} /api/node/get-interview-summary
   * @apiSuccess {object} - { summary: {...} }
   */
  {
    name: 'getInterviewSummary',
    method: 'post',
    url: '/get-interview-summary',
    fn: controllers.getInterviewSummary
  },

  /**
   * Provide the registartion
   *
   * @api {post} /api/node/provide-registration
   * @apiParam {string} target
   * @apiSuccess {object} - { results: [...] }
   */
  {
    name: 'provideRegistration',
    method: 'post',
    url: '/provide-registration',
    fn: controllers.provideRegistration
  },

  /**
   * Get the approval info
   *
   * @api {post} /api/node/get-approval-info
   * @apiParam {string} action
   * @apiParam {string} key
   * @apiSuccess {object} - { info }
   */
  {
    name: 'getApprovalInfo',
    method: 'post',
    url: '/get-approval-info',
    fn: controllers.getApprovalInfo
  },

  /**
   * Check the approval answer
   *
   * @api {post} /api/node/check-approval-answer
   * @apiParam {string} answer
   * @apiParam {string} key
   * @apiParam {string} clientIp
   * @apiParam {string[]} approvers
   * @apiSuccess {object} - { success }
   */
  {
    name: 'checkApprovalAnswer',
    method: 'post',
    url: '/check-approval-answer',
    fn: controllers.checkApprovalAnswer
  }
];
