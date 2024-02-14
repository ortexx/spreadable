import loggerModule from "./transports/logger/index.js";
import consoleModule from "./transports/console/index.js";
import fileModule from "./transports/file/index.js";
import adapterModule from "./transports/adapter/index.js";

const Logger = loggerModule();
const LoggerConsole = consoleModule();
const LoggerFile = fileModule();
const LoggerAdapter = adapterModule();

export default class Loggers {
  constructor() {
    if (!Loggers.instance) {
      Loggers.instance = this;
      this.loggers = [ Logger, LoggerConsole, LoggerFile, LoggerAdapter ];
    }

    return Loggers.instance;
  }

  getLoggers() {
    return Loggers.instance.loggers;
  }

  addLogger(Logger) {
    Loggers.instance.loggers.push(Logger);
  }
}
