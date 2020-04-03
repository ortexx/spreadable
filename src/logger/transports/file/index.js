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
      this.__queue = [];
      this.prepareOptions();
    }

    /**
     * @see Logger.prototype.init
     */
    async init() {
      await fse.ensureDir(this.options.folder);
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

      return new Promise((resolve, reject) => {
        const fn = async () => {
          let err;

          try {
            let lastFile = await this.getLastFile();
            message = this.prepareMessage(message, level);
    
            if(!lastFile) {
              lastFile = await this.addNewFile();
            }
    
            if(lastFile.stat.size + this.getMessageSize(message) > this.options.fileMaxSize) {
              lastFile = await this.addNewFile();
            }
    
            await this.addNewMessage(message, lastFile.filePath);
            await this.normalizeFilesCount();
          }
          catch(e) {
            err = e;
          }

          err? reject(err): resolve();
          this.__queue.shift();
          this.__queue.length && this.__queue[0]();
        }; 
        this.__queue.push(fn);
        this.__queue.length <= 1 && fn();
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
     * @returns { object }
     */
    async addNewFile() {       
      const last = await this.getLastFile();
      const index = last? last.index + 1: 1;
      const filePath = path.join(this.options.folder, `${ index }.log`);
      await fse.ensureFile(filePath);
      return { filePath, stat: await fse.stat(filePath), index };
    }

    /**
     * Get the last file
     * 
     * @async
     * @returns {object}
     */
    async getLastFile() {
      const files = await fse.readdir(this.options.folder);
      const stats = [];
      
      for(let i = 0; i < files.length; i++) {
        const filePath = path.join(this.options.folder, files[i]);
        const stat = await fse.stat(filePath);
        stats.push({
          filePath,
          index: parseInt(path.basename(filePath)),
          stat
        });
      }

      return _.orderBy(stats, 'index', 'desc')[0] || null;
    }

    /**
     * Normalize the files count
     * 
     * @async
     */
    async normalizeFilesCount() {
      let files = await fse.readdir(this.options.folder);

      if(!files.length) {
        return await this.addNewFile();
      }

      if(files.length <= this.options.filesCount) {
        return;
      }

      const diff = files.length - this.options.filesCount;
      const stats = [];
      
      for(let i = 0; i < files.length; i++) {
        const filePath = path.join(this.options.folder, files[i]);
        stats.push({ filePath, index: parseInt(path.basename(filePath)) });
      }
      
      const ordered = _.orderBy(stats, 'index', 'asc');
      const excess = ordered.slice(0, diff);
      const rest = ordered.slice(diff);

      for(let i = 0; i < excess.length; i++) {
        const file = excess[i];
        await fse.remove(file.filePath);
      }

      for(let i = 0; i < rest.length; i++) {
        const file = rest[i];
        await fse.rename(file.filePath, path.join(this.options.folder, `${ i + 1 }.log`));
      }
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