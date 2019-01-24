const chalk = require('chalk');

/**
 * Show the node status info
 */
module.exports.status = async node => {
  const info = await node.getStatusInfo(true);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(JSON.stringify(info, null, 2)));
}