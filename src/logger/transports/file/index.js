const path = require('path');
const fse = require('fs-extra');
const _ = require('lodash');
const Logger = require('../logger')();
const utils = require('../../../utils');

module.exports = (Parent) => {
  /**
   * File logger transport
   */
  return class LoggerFile extends (Parent || Logger) {
    constructor(node, options) {
      options = _.merge({
        filesCount: 5,
        fileMaxSize: '10mb',
        folder: path.join(node.storagePath, `logs`)
      }, options);
      
      super(node, options);
      this.defaultLevel = 'warn';
      this.__filesQueue = new utils.FilesQueue(this.options.folder, {
        limit: this.options.filesCount,
        ext: 'log'
      });
      this.prepareOptions();
    }

    /**
     * @see Logger.prototype.init
     */
    async init() {
      await this.normalizeFilesCount();
      return await super.init.apply(this, arguments);
    }

    /**
     * @see Logger.prototype.deinit
     */
    async deinit() {
      this.__queue = [];
      return await super.deinit.apply(this, arguments);
    }

    /**
     * @see Logger.prototype.destroy
     */
    async destroy() {
      await fse.remove(this.options.folder);
      return await super.destroy.apply(this, arguments);
    }

    /**
     * @see Logger.prototype.log
     */
    async log(level, message) {
      if(!this.isLevelActive(level)) {   
        return;
      }

      return await this.__filesQueue.blocking(async () => {
        let lastFile = this.getLastFile();
        message = this.prepareMessage(message, level);

        if(!lastFile) {
          lastFile = await this.addNewFile();
        }

        if(lastFile.stat.size + this.getMessageSize(message) > this.options.fileMaxSize) {
          lastFile = await this.addNewFile();
        }

        await this.addNewMessage(message, lastFile.filePath);
      });     
    }

    /**
     * Add a new message
     * 
     * @param {string} message
     * @param {string} filePath
     */
    async addNewMessage(message, filePath) {     
      await fse.appendFile(filePath, message + '\n');
    }

    /**
     * Add a new file
     * 
     * @async
     * @returns {Object}
     */
    async addNewFile() {
      const filePath = path.join(this.__filesQueue.folderPath, this.__filesQueue.createNewName());
      await fse.ensureFile(filePath);
      await this.__filesQueue.normalize();
      return this.getLastFile();
    }    

    /**
     * Normalize the files count
     * 
     * @async
     */
    async normalizeFilesCount() {
      await this.__filesQueue.normalize();

      if(!this.__filesQueue.files.length) {
        return await this.addNewFile();
      }
    }

    /**
     * Get the last file
     * 
     * @returns {object}
     */
    getLastFile() {
      return this.__filesQueue.getLast();
    }

    /**
     * Get the message size
     * 
     * @param {string} message 
     * @returns {number}
     */
    getMessageSize(message) {
      return Buffer.byteLength(message, 'utf8');
    }

    /**
     * Prepare the message
     * 
     * @param {string} message 
     * @param {string} level
     * @returns {number}
     */
    prepareMessage(message, level) {
      message = { message, date: new Date().toUTCString(), level };
      return JSON.stringify(message, null, 2);
    }

    /**
     * Prepare the options
     */
    prepareOptions() {
      this.options.fileMaxSize = utils.getBytes(this.options.fileMaxSize);
    } 
  }
};