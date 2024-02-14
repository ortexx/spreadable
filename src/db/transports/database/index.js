import Service from "../../../service.js";
import merge from "lodash-es/merge.js";
import path from "path";

export default (Parent) => {
  /**
   * Database transport interface
   */
  return class Database extends (Parent || Service) {
    /**
     * @param {object} options
     */
    constructor(options = {}) {
      super(...arguments);
      this.options = merge({
        backups: {
          limit: 3
        }
      }, options);
    }

    /**
     * @see Service.prototype.init
     */
    async init() {
      if (this.options.backups && !this.options.backups.folder) {
        this.options.backups.folder = path.join(this.node.storagePath, 'backups', 'db');
      }

      super.init.apply(this, arguments);
    }

    /**
     * Get the current database path
     *
     * @async
     * @returns {string}
     */
    async backup() {
      throw new Error('Method "backup" is required for database transport');
    }

    /**
     * Restore the database
     *
     * @async
     * @param {number} index
     */
    async restore() {
      throw new Error('Method "restore" is required for database transport');
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
     * Get all slaves
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
     * Get all masters
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
     * Get the masters count
     *
     * @async
     * @returns {integer}
     */
    async getMastersCount() {
      throw new Error('Method "getMastersCount" is required for database transport');
    }

    /**
     * Get the slaves count
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
     * @param {string} availability
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
     * Mark the server as successed
     *
     * @async
     * @param {string} address
     */
    async successServerAddress() {
      throw new Error('Method "successServerAddress" is required for database transport');
    }

    /**
     * Mark the server as failed
     *
     * @async
     * @param {string} address
     */
    async failedServerAddress() {
      throw new Error('Method "failedServerAddress" is required for database transport');
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
     * @param {string} action
     * @param {string} address
     */
    async addBehaviorCandidate() {
      throw new Error('Method "addBehaviorCandidate" is required for database transport');
    }

    /**
     * Normalize the candidates
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
    async cleanBehaviorDelays() {
      throw new Error('Method "cleanBehaviorDelays" is required for database transport');
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
     * Clean the fail behavior
     *
     * @async
     * @param {string} action
     * @param {string} address
     */
    async cleanBehaviorFail() {
      throw new Error('Method "cleanBehaviorFail" is required for database transport');
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
     * Add the approval
     *
     * @async
     * @param {string} action
     * @param {string} clientIp
     * @param {string} key
     * @param {number} startedAt
     * @param {*} [info]
     * @returns {object}
     */
    async addApproval() {
      throw new Error('Method "addApproval" is required for database transport');
    }

    /**
     * Get the approval
     *
     * @param {string} key
     * @returns {object}
     */
    async getApproval() {
      throw new Error('Method "getApproval" is required for database transport');
    }

    /**
     * Use the approval
     *
     * @param {string} key
     * @param {string} address
     */
    async useApproval() {
      throw new Error('Method "useApproval" is required for database transport');
    }

    /**
     * Start the approval
     *
     * @param {string} key
     * @param {*} answer
     */
    async startApproval() {
      throw new Error('Method "startApproval" is required for database transport');
    }

    /**
     * Normalize the approval
     *
     * @async
     */
    async normalizeApproval() {
      throw new Error('Method "normalizeApproval" is required for database transport');
    }

    /**
     * Get all banlist
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
     * Check the ip is in the banlist
     *
     * @async
     * @param {string} ip - ipv6 address
     * @returns {boolean}
     */
    async checkBanlistIp(ip) {
      return !!this.col.banlist.findOne({ ip });
    }

    /**
     * Add the banlist address
     *
     * @async
     * @param {string} address
     * @param {number} lifetime
     * @param {string} [reason]
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
     * Empty the banlist
     *
     * @async
     */
    async emptyBanlist() {
      throw new Error('Method "emptyBanlist" is required for database transport');
    }

    /**
     * Normalize the banlist
     *
     * @async
     */
    async normalizeBanlist() {
      throw new Error('Method "normalizeBanlist" is required for database transport');
    }

    /**
     * Get the cache
     *
     * @async
     * @param {string} type
     * @param {string} key
     */
    async getCache() {
      throw new Error('Method "getCache" is required for database transport');
    }

    /**
     * Set the cache
     *
     * @async
     * @param {string} type
     * @param {string} key
     * @param {string} link
     */
    async setCache() {
      throw new Error('Method "setCache" is required for database transport');
    }

    /**
     * Get the cache
     *
     * @async
     * @param {string} type
     * @param {string} key
     */
    async removeCache() {
      throw new Error('Method "removeCache" is required for database transport');
    }

    /**
     * Get the cache
     *
     * @async
     * @param {string} type
     * @param {object} [options]
     */
    async normalizeCache() {
      throw new Error('Method "normalizeCache" is required for database transport');
    }

    /**
     * Flush the cache
     *
     * @async
     * @param {string} type
     */
    async flushCache() {
      throw new Error('Method "flushCache" is required for database transport');
    }
  };
};
