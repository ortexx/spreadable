const fse = require('fs-extra');
const tools = require('./tools');

describe('spreadable', () => {
  before(() => fse.ensureDir(tools.tmpPath));
  after(() => fse.remove(tools.tmpPath));
  require('./utils');
  require('./service');
  require('./node');
  require('./client');
  require('./services');
  require('./routes');
  require('./group');
});