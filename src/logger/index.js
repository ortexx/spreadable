const Logger = require('./transports/logger')();
const LoggerConsole = require('./transports/console')();
const LoggerFile = require('./transports/file')();
const LoggerAdapter = require('./transports/adapter')();

module.exports = {
  Logger,
  LoggerConsole,
  LoggerFile,
  LoggerAdapter
};