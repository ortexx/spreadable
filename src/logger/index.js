import logger from "./transports/logger/index.js";
import loggerConsole from "./transports/console/index.js";
import loggerFile from "./transports/file/index.js";

const Logger = logger();
const LoggerConsole = loggerConsole();
const LoggerFile = loggerFile();

export default {
  Logger,
  LoggerConsole,
  LoggerFile
}
