#!/usr/bin/env node

const runner = require('./runner');
const Node = require('../src').Node;
runner('spreadable', Node, require('./actions'));
