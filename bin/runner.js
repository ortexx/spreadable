import chalk from "chalk";
import yargs from "yargs";
import path from "path";
import merge from "lodash-es/merge.js";
import { Spinner } from "cli-spinner";
import utils from "./utils.js";

const argv = yargs(process.argv).argv;

export default async (name, Node, actions) => {
  let node;
  ['SIGINT', 'SIGQUIT', 'SIGTERM', 'uncaughtException'].forEach((sig) => {
    process.on(sig, async () => {
      try {
        await node.deinit();
        process.exit();
      }
      catch (err) {
        //eslint-disable-next-line no-console
        console.error(err.stack);
        process.exit(1);
      }
    });
  });

  try {
    const action = argv.action || argv.a;
    const logger = argv.logger === undefined ? argv.l : argv.logger;
    const server = argv.server === undefined ? argv.s : argv.server;
    let configPath = argv.configPath || argv.c;
    let config;
    let spinner;

    if (configPath) {
      configPath = utils.getAbsolutePath(configPath);
    }
    else {
      configPath = path.join(process.cwd(), name + '.config');
    }

    try {
      config = (await import(configPath)).default;
    }
    catch (err) {
      throw new Error(`Not found the config file ${ configPath }`);
    }
    
    config = merge(config, {
      logger: logger === false ? false : config.logger,
      server: server === false ? false : config.server
    });
    node = new Node(config);

    if (!node.options.logger.level) {
      spinner = new Spinner('Initializing... %s');
      spinner.start();
    }

    await node.init();
    spinner && spinner.stop(true);
    //eslint-disable-next-line no-console
    console.log(chalk.cyan('Node has been initialized'));

    if (action) {
      if (!actions[action]) {
        throw new Error(`Not found action "${action}"`);
      }
      
      await actions[action](node);
      await node.deinit();
      process.exit();
    }
  }
  catch (err) {
    //eslint-disable-next-line no-console
    console.error(chalk.red(err.stack));
    node && await node.deinit();
    process.exit(1);
  }
};
