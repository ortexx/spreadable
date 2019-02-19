module.exports = () => {
  /**
   * Database transport interface
   */
  return class Database {
    /**
     * @param {Node} node 
     * @param {object} options 
     */
    constructor(node, options = {}) {
      this.node = node;
      this.options = options;
    }

    /** 
     * Initialize the database
     * 
     * @async
     */
    async init() {
      this.__initialized = true;
      this.node.logger.info(`Database has been initialized`);      
    }
    
    /** 
     * Denitialize the database
     * 
     * @async
     */
    async deinit() {
      this.__initialized = false;
      this.node.logger.info(`Database has been deinitialized`);
    }

    /**
     * Destroy the database
     * 
     * @async
     */
    async destroy() {
      await this.deinit();
      this.node.logger.info(`Database has been destroyed`);
    }

    /**
     * Set the data
     * 
     * @async
     * @param {string} name
     * @param {*} value
     */
    async setData() {
      throw new Error('Method "setData" is required for database transport');
    }

    /**
     * Get the data
     * 
     * @async
     * @param {string} name
     * @returns {*}
     */
    async getData() {
      throw new Error('Method "getData" is required for database transport');
    }

    /**
     * Check the node is master
     * 
     * @async
     * @returns {boolean}
     */
    async isMaster() {
      throw new Error('Method "isMaster" is required for database transport');
    }
    
    /**
     * Get the server
     * 
     * @async
     * @param {string} address
     * @returns {object}
     */
    async getServer() {
      throw new Error('Method "getServer" is required for database transport');
    }

    /**
     * Get all servers
     * 
     * @async
     * @returns {object[]}
     */
    async getServers() {
      throw new Error('Method "getServers" is required for database transport');
    }

    /**
     * Check the node has the slave
     * 
     * @async
     * @returns {boolean}
     */
    async hasSlave() {
      throw new Error('Method "hasSlave" is required for database transport');
    }

    /**
     * Get slaves
     * 
     * @async
     * @returns {object[]}
     */
    async getSlaves() {
      throw new Error('Method "getSlaves" is required for database transport');
    }

    /**
     * Get the master
     * 
     * @async
     * @param {string} address
     * @returns {object}
     */
    async getMaster() {
      throw new Error('Method "getMaster" is required for database transport');
    }

    /**
     * Get masters
     * 
     * @async
     * @returns {object[]}
     */
    async getMasters() {
      throw new Error('Method "getMasters" is required for database transport');
    }

    /**
     * Get the backlink
     * 
     * @async
     * @returns {object}
     */
    async getBacklink() {
      throw new Error('Method "getBacklink" is required for database transport');
    }

    /**
     * Get masters count
     * 
     * @async
     * @returns {integer}
     */
    async getMastersCount() {
      throw new Error('Method "getMastersCount" is required for database transport');
    }

    /**
     * Get slaves count
     * 
     * @async
     * @returns {integer}
     */
    async getSlavesCount() {
      throw new Error('Method "getSlavesCount" is required for database transport');
    }
    
    /**
     * Add the master
     * 
     * @async
     * @param {string} address
     * @param {integer} size
     * @param {boolean} isAccepted
     * @param {integer} updatedAt
     * @returns {object}
     */
    async addMaster() {
      throw new Error('Method "addMaster" is required for database transport');
    }

    /**
     * Add the slave
     * 
     * @async
     * @param {string} address
     * @returns {object}
     */
    async addSlave() {
      throw new Error('Method "addSlave" is required for database transport');
    }

    /**
     * Add the backlink
     * 
     * @async
     * @param {string} address
     * @param {string[]} chain
     * @returns {object}
     */
    async addBacklink() {
      throw new Error('Method "addBacklink" is required for database transport');    
    }

    /**
     * Remove the master
     * 
     * @async
     * @param {string} address
     */
    async removeMaster() {
      throw new Error('Method "removeMaster" is required for database transport'); 
    }

    /**
     * Remove the server
     * 
     * @async
     * @param {string} address
     */
    async removeServer() {
      throw new Error('Method "removeServer" is required for database transport');
    }
    
    /**
     * Remove the slave
     * 
     * @async
     * @param {string} address
     */
    async removeSlave() {
      throw new Error('Method "removeSlave" is required for database transport');
    }

    /**
     * Remove all slaves
     * 
     * @async
     */
    async removeSlaves() {
      throw new Error('Method "removeSlaves" is required for database transport');
    }
    
    /**
     * Shift the slaves
     * 
     * @async
     * @param {integer} [limit=1]
     */
    async shiftSlaves() {
      throw new Error('Method "shiftSlaves" is required for database transport');
    }

    /**
     * Remove the backlink
     * 
     * @async
     * @param {string} address
     */
    async removeBacklink() {
      throw new Error('Method "removeBacklink" is required for database transport');
    }

    /**
     * Normalize the servers
     * 
     * @async
     */
    async normalizeServers() {
      throw new Error('Method "normalizeServers" is required for database transport');
    }

    /**
     * Mark the server successed
     * 
     * @async
     * @param {string} address
     */
    async successServerAddress() {
      throw new Error('Method "successServerAddress" is required for database transport');
    }

    /**
     * Mark the server failed
     * 
     * @async
     * @param {string} address
     */
    async failedServerAddress() {
      throw new Error('Method "failedServerAddress" is required for database transport');
    }

    /**
     * Decrease the server delays
     * 
     * @async
     * @param {string} address
     */
    async decreaseServerDelays(address) {
      let server = this.col.servers.findOne({ address });

      if(server) {
        server.delays = server.delays >= 1? server.delays - 1: 0;
        server.delays == 0 && (server.isBroken = false);
        this.col.servers.update(server);
      }
    }

    /**
     * Increase the server delays
     * 
     * @async
     * @param {string} address
     */
    async increaseServerDelays(address) {
      let server = this.col.servers.findOne({ address });

      if(!server) {
        return false;
      }

      server.delays += 1;

      if(server.delays > this.node.options.network.serverMaxDelays) {
        server.isBroken = true;
      }

      this.col.servers.update(server);
    }

    /**
     * Get suspicious candidades
     * 
     * @async
     * @param {string} action
     * @returns {object[]}
     */
    async getBehaviorCandidates() {
      throw new Error('Method "getBehaviorCandidates" is required for database transport');
    }

    /**
     * Add the candidade
     * 
     * @async
     * @param {string} address
     * @param {string} action
     */
    async addBehaviorCandidate() {
      throw new Error('Method "addBehaviorCandidate" is required for database transport');
    }

    /**
     * Normalize candidates
     * 
     * @async
     */
    async normalizeBehaviorCandidates() {
      throw new Error('Method "normalizeBehaviorCandidates" is required for database transport');
    }

    /**
     * Add the delay behavior
     * 
     * @async
     * @param {string} action
     * @param {string} address
     */
    async addBehaviorDelay() {
      throw new Error('Method "addBehaviorDelay" is required for database transport');
    }

    /**
     * Get the delay behavior
     * 
     * @async
     * @param {string} action 
     * @param {string} address
     * @returns {object}
     */
    async getBehaviorDelay() {
      throw new Error('Method "getBehaviorDelay" is required for database transport');
    }

    /**
     * Remove the delay behavior
     * 
     * @async
     * @param {string} action 
     * @param {string} address
     */
    async removeBehaviorDelay() {
      throw new Error('Method "removeBehaviorDelay" is required for database transport');
    }

    /**
     * Clear the delay behaviors
     * 
     * @async
     * @param {string} action
     */
    async clearBehaviorDelays() {
      throw new Error('Method "clearBehaviorDelays" is required for database transport');
    }

    /**
     * Get the fail behavior
     * 
     * @async
     * @param {string} action 
     * @param {string} address
     * @returns {object}
     */
    async getBehaviorFail() {
      throw new Error('Method "getBehaviorFail" is required for database transport');
    }

    /**
     * Add the fail behavior
     * 
     * @async
     * @param {string} action 
     * @param {string} address
     * @param {number} [step=1]
     */
    async addBehaviorFail() {
      throw new Error('Method "addBehaviorFail" is required for database transport');
    }

    /**
     * Subtract the fail behavior
     * 
     * @async
     * @param {string} action 
     * @param {string} address
     * @param {number} [step=1]
     */
    async subBehaviorFail() {
      throw new Error('Method "subBehaviorFail" is required for database transport');
    }

    /**
     * Normalize the behavior fails
     * 
     * @async
     */
    async normalizeBehaviorFails() {
      throw new Error('Method "normalizeBehaviorFails" is required for database transport');
    }

    /**
     * Get the banlist
     * 
     * @async
     * @returns {object[]}
     */
    async getBanlist() {
      throw new Error('Method "getBanlist" is required for database transport');
    }

    /**
     * Get the banlist address
     * 
     * @async
     * @param {string} address
     * @returns {object}
     */
    async getBanlistAddress() {
      throw new Error('Method "getBanlistAddress" is required for database transport');
    }

    /**
     * Add the banlist address
     * 
     * @async
     * @param {string} address
     */
    async addBanlistAddress() {
      throw new Error('Method "addBanlistAddress" is required for database transport');
    }

    /**
     * Remove the banlist address
     * 
     * @async
     * @param {string} address
     */
    async removeBanlistAddress() {
      throw new Error('Method "removeBanlistAddress" is required for database transport');
    }

    /**
     * Normalize the banlist
     * 
     * @async
     */
    async normalizeBanlist() {
      throw new Error('Method "normalizeBanlist" is required for database transport');
    }
  }
};