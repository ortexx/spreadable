#!/usr/bin/env node
import runner from "./runner.js";
import { Node } from "../src/index.js";
import actions from "./actions.js";

runner('spreadable', Node, actions);
