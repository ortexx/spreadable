import * as loggerModule from "./transports/logger/index.js";
import * as consoleModule from "./transports/console/index.js";
import * as fileModule from "./transports/file/index.js";
import * as adapterModule from "./transports/adapter/index.js";

const Logger = loggerModule;
const LoggerConsole = consoleModule;
const LoggerFile = fileModule;
const LoggerAdapter = adapterModule;

export { Logger, LoggerConsole, LoggerFile, LoggerAdapter };
export default { Logger, LoggerConsole, LoggerFile, LoggerAdapter };
