const chalk = require('chalk');
const argv = require('optimist').argv;
const path = require('path');
const _ = require('lodash');
const Spinner = require('cli-spinner').Spinner;

module.exports = async (name, Node, actions) => {
  let node;

  ['SIGINT', 'SIGQUIT', 'SIGTERM', 'uncaughtException'].forEach((sig) => {
    process.on(sig, async () => {
      try {
        await node.deinit();
        process.exit();
      }
      catch(err) {
        //eslint-disable-next-line no-console
        console.error(err.stack);
        process.exit(1);
      }
    });
  });

  try {
    let configPath = '';
    let action = argv.a || argv.action;  
    let config = argv.c || argv.config;
    let spinner;

    if(config) {
      const dir = config + '';
      configPath = path.isAbsolute(dir)? dir: path.join(process.cwd(), dir);
    }
    else {
      configPath = path.join(process.cwd(), name + '.config');
    }

    try {
      config = require(configPath);
    }
    catch(err) {
      throw new Error(`Not found config file ${configPath}. Pass argument "c" with the config path or create "${name}.config.js(on)" file`);
    }

    config = _.merge(config, {
      logger: argv.l === false? false: (config.logger || {})
    });
  
    node = new Node(config);

    if(!node.options.logger.level) {
      spinner = new Spinner('Initializing... %s');
      spinner.start();
    }

    await node.init();  
    spinner && spinner.stop(true);
    //eslint-disable-next-line no-console
    console.log(chalk.cyan('Node has been initialized'));

    if(action) {
      if(!actions[action]) {
        throw new Error(`Not found action "${action}"`);
      }

      await actions[action](node);
      await node.deinit();
      process.exit();
    }
  }
  catch(err) {
    //eslint-disable-next-line no-console
    console.error(chalk.red(err.stack));
    node && await node.deinit();
    process.exit(1);
  }
}
    
