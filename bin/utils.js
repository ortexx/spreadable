const path = require('path');
const utils = {};

/**
 * Get the file absolute path
 * 
 * @param {string} file
 * @param {string} [entry] - the entry point
 * @returns {string}
 */
utils.getAbsolutePath = function (file, entry = process.cwd()) {
  return path.isAbsolute(file)? file: path.resolve(entry, file);
}

module.exports = utils;