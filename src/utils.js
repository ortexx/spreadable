const validateIP = require('validate-ip-node');
const bytes = require('bytes');
const ms = require('ms');
const dns = require('dns');
const tcpPortUsed = require('tcp-port-used');

const utils = {
  hostValidationRegex: /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/
};

utils.getRandomElement = function (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Convert string to milliseconds
 * 
 * @param {string|integer} val
 * @returns {integer}
 */
utils.getMs = function (val) {
  if(typeof val != 'string' || val == 'auto') {
    return val;
  }

  return ms(val);
};

/**
 * Convert string to bytes
 * 
 * @param {string|integer} val
 * @returns {integer|string}
 */
utils.getBytes = function (val) {
  if(typeof val != 'string' || val.match('%') || val == 'auto') {
    return val;
  }

  return bytes(val);
};

/**
 * Get cpu usage percent
 * 
 * @async
 * @param {object} options
 * @returns {float}
 */
utils.getCpuUsage = async function(options = {}) {
  return await new Promise((resolve, reject) => {
    const startUsage = process.cpuUsage();
    const startTime  = process.hrtime();

    setTimeout(() => {  
      try {
        const info = process.cpuUsage(startUsage);
        const elapTime = process.hrtime(startTime);
        const elapTimeUs = elapTime[0] * 1000000 + elapTime[1] / 1000;
        const cpuPercent = 100 * (info.user + info.system) / elapTimeUs;
        resolve(cpuPercent);
      }
      catch(err) {
        reject(err);
      }      
    }, options.timeout);
  });
}

/**
 * Check the port is used
 * 
 * @async
 * @param {integer} port
 * @returns {boolean}
 */
utils.isPortUsed = async function (port) {
  return await tcpPortUsed.check(+port, 'localhost');
}

/**
 * Get ip address by hostname
 * 
 * @async
 * @param {string} hostname
 * @returns {string}
 */
utils.getHostIp = async function (hostname) {
  if(hostname == 'localhost') {
    return '127.0.0.1';
  }

  return await new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, ip) => {      
      if(err) {
        if(err.code == 'ENOTFOUND') {
          return resolve(null);
        }
        
        return reject(err);
      }

      return resolve(ip);
    });
  });
};

/**
 * Make multiple requests with the common timeout
 * 
 * @async
 * @param {number} timeout 
 * @param {function} fn 
 */
utils.getRequestTimer = function (timeout) {
  let last = Date.now(); 

  return fixArr => {
    if(timeout !== undefined) {
      const now = Date.now();
      timeout -= now - last;
      last = now;

      if(fixArr && !Array.isArray(fixArr)) {
        fixArr = [fixArr];
      }

      if(fixArr) {
        const dev = fixArr.reduce((a, b) => a + b) / timeout;
        return dev > 1? (fixArr[0] / dev): fixArr[0];
      }
    }

    return timeout;
  };
};

/**
 * Return request client ip address;
 * 
 * @param {http.ClientRequest} req 
 * @returns {string}
 */
utils.getRemoteIp = function (req) {
  let ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();

  if(ip.match('::')) {
    ip = ip.replace(/^::1/, '127.0.0.1').replace(/^::ffff:/, '');
  }

  return ip;
};

/**
 * Check the port is valid
 * 
 * @param {string} port
 * @returns {boolean}
 */
utils.isValidPort = function (port) {
  return +port > 0 &&  +port <= 65535;
}

/**
 * Check the  ip is valid
 * 
 * @param {string} ip
 * @returns {boolean}
 */
utils.isValidIp = function (ip) {
  return validateIP(ip);
}

/**
 * Check the hostname is valid
 * 
 * @param {string} hostname
 * @returns {boolean}
 */
utils.isValidHostname = function (hostname) {
  if(typeof hostname != 'string') {
    return false;
  }
  
  return this.hostValidationRegex.test(hostname) || this.isValidIp(hostname);
}

/**
 * Check the address is valid
 * 
 * @param {string} address - address as "ip:port"
 * @returns {boolean}
 */
utils.isValidAddress = function (address) {
  if(!address || typeof address != 'string') {
    return false;
  }

  const parts = address.split(/:(?=[0-9]{1,5}$)/);
  const host = parts[0];
  const port = +parts[1];
  return this.isValidHostname(host) && this.isValidPort(port);
};

/**
 * Create the request timed out error
 * 
 * @returns {Error}
 */
utils.createRequestTimeoutError = function () {
  const err = new Error('Request timed out');
  err.code = 'ERR_SPREADABLE_REQUEST_TIMEDOUT';
  return err;
};

/**
 * Check the error is request timed out
 * 
 * @param {Error} err
 * @returns {boolean}
 */
utils.isRequestTimeoutError = function (err) {
  return ['ESOCKETTIMEDOUT', 'ETIMEDOUT'].indexOf(err.code) != -1;
};

module.exports = utils;
