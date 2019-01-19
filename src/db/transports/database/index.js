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
     * @param {boolean} [onlyAccepted]
     * @returns {object}
     */
    async getMaster() {
      throw new Error('Method "getMaster" is required for database transport');
    }

    /**
     * Get masters
     * 
     * @async
     * @param {boolean} [onlyAccepted]
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
     * @param {boolean} [onlyAccepted]
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
     * Get the network size
     * 
     * @async
     * @returns {integer}
     */
    async getNetworkSize() {
      throw new Error('Method "getNetworkSize" is required for database transport');
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
    async getSuspiciousCandidates() {
      throw new Error('Method "getSuspiciousCandidates" is required for database transport');
    }

    /**
     * Add the candidade
     * 
     * @async
     * @param {string} address
     * @param {string} action
     */
    async addCandidate() {
      throw new Error('Method "addCandidate" is required for database transport');
    }

    /**
     * Normalize candidates
     * 
     * @async
     */
    async normalizeCandidates() {
      throw new Error('Method "normalizeCandidates" is required for database transport');
    }
  }
};