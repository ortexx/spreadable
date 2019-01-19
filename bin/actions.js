const chalk = require('chalk');

/**
 * Show the node network info
 */
module.exports.showNetworkInfo = async node => {
  const info = { networkSize: await node.getNetworkSize() };
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(JSON.stringify(info, null, 2)));
}