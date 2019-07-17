
const controllers = require('./controllers');

module.exports = [
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
   * Provide the node structure
   * 
   * @api {post} /api/node/provide-structure
   * @apiSuccess {object} - { slaves: [...], masters: [...], backlink: {...} }
   */
  { 
    name: 'provideStructure', 
    method: 'post', 
    url: '/provide-structure', 
    fn: controllers.provideStructure
  },

   /**
   * Provide the node structure group
   * 
   * @api {post} /api/node/provide-group-structure
   * @apiSuccess {object[]}
   */
  { 
    name: 'provideGroupStructure', 
    method: 'post', 
    url: '/provide-group-structure', 
    fn: controllers.provideGroupStructure
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
  }
];
