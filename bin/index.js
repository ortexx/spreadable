#!/usr/bin/env node
import runner from "./runner.js";
import { Node } from "../src/index.js";
import * as actions from "./actions.js";

runner('spreadable', Node, actions);
