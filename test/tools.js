import path from "path";
import merge from "lodash-es/merge.js";
import shuffle from "lodash-es/shuffle.js";
import getPort from "get-port";
import FormData from "form-data";
import fse from "fs-extra";
const tools = {};
tools.tmpPath = path.join(process.cwd(), 'test/tmp');

/**
 * Get the database path
 *
 * @param {number} port
 * @returnss {string}
 */
tools.getDbFilePath = function (node) {
  return path.join(node.storagePath, 'loki.db');
};

/**
 * Create an actual request options
 *
 * @param {object} [options]
 * @returnss {object}
 */
tools.createJsonRequestOptions = function (options = {}) {
  let body = options.body;
  typeof body == 'object' && (body = JSON.stringify(body));
  return merge({
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    }
  }, options, { body });
};

/**
 * Create a request form data
 *
 * @param {object} body
 * @returns {FormData}
 */
tools.createRequestFormData = function (body) {
  const form = new FormData();

  for (let key in body) {
    let val = body[key];

    if (typeof val == 'object') {
      form.append(key, val.value, val.options);
    }
    else {
      form.append(key, val);
    }
  }
  
  return form;
};

/**
 * Create an actual server response
 *
 * @param {string} address
 * @param {object} res
 * @returnss {object}
 */
tools.createServerResponse = function (address, res) {
  res.address = address;
  return res;
};

/**
 * Save the response to a file
 *
 * @async
 * @param {http.ServerResponse}
 */
tools.saveResponseToFile = async function (response, filePath) {
  await new Promise((resolve, reject) => {
    try {
      const ws = fse.createWriteStream(filePath);
      response.body
        .on('error', reject)
        .pipe(ws)
        .on('error', reject)
        .on('finish', resolve);
    }
    catch (err) {
      reject(err);
    }
  });
};

/**
 * Get free port
 *
 * @async
 * @returns {number}
 */
tools.getFreePort = async function () {
  return await getPort();
};

/**
 * Create the node options
 *
 * @async
 * @param {object} [options]
 * @returns {object}
 */
tools.createNodeOptions = async function (options = {}) {
  const port = options.port || await this.getFreePort();
  return merge({
    port,
    task: false,
    request: {
      pingTimeout: 500,
      serverTimeout: 600
    },
    network: {
      syncInterval: 1000,
      autoSync: false,
      serverMaxFails: 1
    },
    logger: false,
    initialNetworkAddress: `localhost:${port}`,
    hostname: 'localhost',
    storage: {
      path: path.join(this.tmpPath, 'node-' + port)
    }
  }, options);
};

/**
 * Create the client options
 *
 * @async
 * @param {object} [options]
 * @returns {object}
 */
tools.createClientOptions = async function (options = {}) {
  return merge({
    logger: false,
    task: false
  }, options);
};

/**
 * Wait for the timeout
 *
 * @async
 * @param {number} timeout
 */
tools.wait = async function (timeout) {
  return await new Promise(resolve => setTimeout(resolve, timeout));
};

/**
 * Sync each node in the list
 *
 * @async
 * @param {object[]} nodes
 * @param {number} [count]
 */
tools.nodesSync = async function (nodes, count = 1) {
  nodes = shuffle(nodes);
  
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < nodes.length; k++) {
      try {
        await nodes[k].sync();
      }
      catch (err) {
        if (['ERR_SPREADABLE_REQUEST_TIMEDOUT'].includes(err.code)) {
          throw err;
        }
      }
    }
  }
};

export default tools;
