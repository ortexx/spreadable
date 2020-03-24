const chalk = require('chalk');
const argv = require('yargs').argv;
const srcUtils = require('../src/utils');

/**
 * Show the node status info
 */
module.exports.status = async node => {
  const info = await node.getStatusInfo(true);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(JSON.stringify(info, null, 2)));
};

/**
 * Add the address to the banlist
 */
module.exports.addBanlistAddress = async node => {
  const address = argv.n || argv.address;
  const lifetime = srcUtils.getMs(argv.t || argv.lifetime);
  const reason = argv.r || argv.reason;

  if(!srcUtils.isValidAddress(address)) {
    throw new Error(`Address is invalid`);
  }

  if(!lifetime) {
    throw new Error(`Lifetime is required`);
  }

  await node.db.addBanlistAddress(address, +lifetime, reason);
  
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`Address "${address}" has been added to the banlist`));
};

/**
 * Remove the address from the banlist
 */
module.exports.removeBanlistAddress = async node => {
  const address = argv.n || argv.address;

  if(!address) {
    throw new Error(`Address is required`);
  }

  await node.db.removeBanlistAddress(address);
  
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`Address "${address}" has been removed from the banlist`));
};