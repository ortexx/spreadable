import validateIP from "validate-ip-node";
import bytes from "bytes";
import ms from "ms";
import os from "os";
import fse from "fs-extra";
import path from "path";
import uniqBy from "lodash-es/uniqBy.js"
import dns from "dns";
import tcpPortUsed from "tcp-port-used";
import fetch from 'node-fetch';
import crypto from "crypto";
import ip6addr from "ip6addr";
import { WorkError } from "./errors.js";

const utils = {
  domainValidationRegex: /^localhost|[\p{L}\p{N}-][\p{L}\p{N}-]{1,61}[\p{L}\p{N}](?:\.[\p{L}]{2,})+$/iu,
  dnsCache: new Map(),
  dnsCacheLimit: 10000,
  dnsCachePeriod: 1000 * 60 * 10,
  ipLookupPoints: [
    'https://api.ipify.org/',
    'https://ipinfo.io/ip',
    'https://ifconfig.me/ip',
    'https://checkip.amazonaws.com/'
  ]
};

/**
 * Validate the schema
 *
 * @param {object|array|string} schema
 * @param {*} data
 */
utils.validateSchema = function (schema, data) {
  const fullSchema = Array.isArray(schema) ? schema : [schema];
  const dataType = Array.isArray(data) ? 'array' : typeof data;
  const getHumanData = () => JSON.stringify(data, null, 2);
  let err = null;
  let isValid = false;

  for (let i = 0; i < fullSchema.length; i++) {
    const schema = typeof fullSchema[i] != 'object' ? { type: fullSchema[i] } : fullSchema[i];
    const getHumanSchema = () => JSON.stringify(schema, null, 2);
    
    try {
      if (schema.type != dataType) {
        const msg = `Wrong data type "${dataType}" instead of "${schema.type}" ${getHumanData()} for ${getHumanSchema()}`;
        throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_WRONG_DATA_TYPE');
      }

      if (dataType == 'array') {
        const minLength = typeof schema.minLength == 'function' ? minLength(data) : schema.minLength;
        const maxLength = typeof schema.maxLength == 'function' ? maxLength(data) : schema.maxLength;
        
        if (minLength && data.length < minLength) {
          const msg = `Wrong array min length ${getHumanData()} for ${getHumanSchema()}`;
          throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_WRONG_ARRAY_MIN_LENGTH');
        }

        if (maxLength && data.length > maxLength) {
          const msg = `Wrong array max length ${getHumanData()} for ${getHumanSchema()}`;
          throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_WRONG_ARRAY_MAX_LENGTH');
        }

        if (schema.uniq) {
          const arr = schema.uniq === true ? uniqBy(data) : uniqBy(data, schema.uniq);
          if (arr.length != data.length) {
            const msg = `Wrong array uniqueness ${getHumanData()} for ${getHumanSchema()}`;
            throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_WRONG_ARRAY_UNIQUENESS');
          }
        }

        if (schema.items) {
          data.forEach(item => this.validateSchema(schema.items, item));
        }
      }
      else if (dataType == 'object') {
        const props = schema.props || {};
        const required = schema.required;
        
        if (required && !Array.isArray(required)) {
          throw new Error(`Option "required" for ${getHumanSchema()} must be an array`);
        }

        if (schema.canBeNull && data === null) {
          isValid = true;
          continue;
        }

        if (schema.canBeNull === false && data === null) {
          const msg = `Data for ${getHumanSchema()} can't be null`;
          throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_NULL');
        }

        if (schema.strict) {
          const schemaKeys = Object.keys(props).sort();
          const dataKeys = Object.keys(data).sort();
          
          if (schemaKeys.toString() != dataKeys.toString()) {
            const msg = `Wrong strict object structure ${getHumanData()} for ${getHumanSchema()}`;
            throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_STRICT');
          }
        }

        if (schema.expected) {
          for (let key in data) {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
              const msg = `Wrong expected object structure ${getHumanData()} for ${getHumanSchema()}`;
              throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_EXPECTED');
            }
          }
        }
        
        const requiredKeys = {};
        required && required.forEach(item => requiredKeys[item] = true);
        
        for (let prop in props) {
          if (!Object.prototype.hasOwnProperty.call(data, prop)) {
            if (required && requiredKeys[prop]) {
              const msg = `Property "${prop}" is required in ${getHumanData()} for ${getHumanSchema()}`;
              throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_REQUIRED_PROPS');
            }
            continue;
          }
          this.validateSchema(props[prop], data[prop]);
        }
      }
      if (!Object.prototype.hasOwnProperty.call(schema, 'value')) {
        isValid = true;
        continue;
      }

      let valid;
      
      if (typeof schema.value == 'function') {
        valid = schema.value(data);
      }
      else if (schema.value instanceof RegExp) {
        valid = String(data).match(schema.value);
      }
      else {
        const value = Array.isArray(schema.value) ? schema.value : [schema.value];
        valid = value.indexOf(data) != -1;
      }

      if (!valid) {
        const msg = `Validation is failed for ${getHumanData()}`;
        throw new WorkError(msg, 'ERR_SPREADABLE_VALIDATE_SCHEMA_VALUE');
      }

      isValid = true;
    }
    catch (error) {
      err = error;
    }
  }

  if (!isValid && err) {
    throw err;
  }
};

/**
 * Check it is the browser environment here
 *
 * @returns {boolean}
 */
utils.isBrowserEnv = function () {
  return typeof window == 'object';
};

/**
 * Get a random element from the array
 *
 * @param {array} arr
 * @returns {*}
 */
utils.getRandomElement = function (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Convert the string to milliseconds
 *
 * @param {string|integer} val
 * @returns {integer}
 */
utils.getMs = function (val) {
  if (typeof val != 'string' || val == 'auto') {
    return val;
  }

  return ms(val);
};

/**
 * Convert the string to bytes
 *
 * @param {string|integer} val
 * @returns {integer|string}
 */
utils.getBytes = function (val) {
  if (typeof val != 'string' || val.match('%') || val == 'auto') {
    return val;
  }

  return bytes(val);
};

/**
 * Get the cpu usage percent
 *
 * @async
 * @param {object} options
 * @returns {float}
 */
utils.getCpuUsage = async function (options = {}) {
  return await new Promise((resolve, reject) => {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime();
    setTimeout(() => {
      try {
        const info = process.cpuUsage(startUsage);
        const elapTime = process.hrtime(startTime);
        const elapTimeUs = elapTime[0] * 1000000 + elapTime[1] / 1000;
        const cpuPercent = 100 * (info.user + info.system) / elapTimeUs;
        resolve(cpuPercent);
      }
      catch (err) {
        reject(err);
      }
    }, options.timeout || 1000);
  });
};

/**
 * Check the port is used
 *
 * @async
 * @param {integer} port
 * @returns {boolean}
 */
utils.isPortUsed = async function (port) {
  return await tcpPortUsed.check(+port, 'localhost');
};

/**
 * Get an ip address of the hostname
 *
 * @async
 * @param {string} hostname
 * @returns {string}
 */
utils.getHostIp = async function (hostname) {
  if (hostname == 'localhost') {
    return '127.0.0.1';
  }

  if (this.isValidIp(hostname)) {
    return hostname;
  }

  const cache = this.dnsCache.get(hostname);
  
  if (cache) {
    if (cache.createdAt + this.dnsCachePeriod > Date.now()) {
      return cache.value;
    }
    else {
      this.dnsCache.delete(hostname);
    }
  }

  return await new Promise((resolve) => {
    dns.lookup(hostname, (err, ip) => {
      if (err || !ip || /^127/.test(ip)) {
        return resolve(null);
      }

      this.isIpv6(ip) && (ip = this.getFullIpv6(ip));
      this.dnsCache.set(hostname, { value: ip, createdAt: Date.now() });

      if (this.dnsCache.size > this.dnsCacheLimit) {
        const keys = Array.from(this.dnsCache.keys()).slice(0, this.dnsCache.size - this.dnsCacheLimit);
        keys.forEach(k => this.dnsCache.delete(k));
      }

      return resolve(ip);
    });
  });
};

/**
 * Get the address ip
 *
 * @see utils.getHostIp
 * @param {string} address
 */
utils.getAddressIp = async function (address) {
  return await this.getHostIp(this.splitAddress(address)[0]);
};

/**
 * Create a requests timer
 *
 * @async
 * @param {number} timeout
 * @param {function} fn
 */
utils.getRequestTimer = function (timeout, options = {}) {
  let last = Date.now();
  return (fixArr, opts) => {
    opts = Object.assign({}, options, opts);
    
    if (fixArr && !Array.isArray(fixArr)) {
      fixArr = [fixArr];
    }

    if (timeout === undefined) {
      return fixArr ? fixArr[0] : undefined;
    }

    const now = Date.now();
    timeout -= now - last;
    last = now;
    
    if (fixArr) {
      let min = opts.min;
      let sum = fixArr.reduce((a, b) => a + b);
      let dev = sum / timeout;
      let res = dev > 1 ? fixArr[0] / dev : fixArr[0];
      res > fixArr[0] && (res = fixArr[0]);
      opts.grabFree && (timeout > sum) && (res += ((timeout - sum) / fixArr.length));
      min && res < min && (res = min);
      res > timeout && (res = timeout);
      return res > 0 ? res : 0;
    }

    return timeout;
  };
};

/**
 * Get an external ip address of the host
 *
 * @async
 * @returns {string}
 */
utils.getExternalIp = async function () {
  let ip = null;

  for (let url of this.ipLookupPoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      const text = await res.text();

      if (this.isValidIp(text)) {
        ip = text;
        break;
      }
    }
    catch (err) {
      continue;
    }
  }

  return ip;
}

/**
 * Get a local ip address of the host
 *
 * @returns {string}
 */
utils.getLocalIp = function () {
  const interfaces = os.networkInterfaces();
  let ip;
  
  for (let k in interfaces) {
    for (let p in interfaces[k]) {
      const address = interfaces[k][p];
      if (address.family === 'IPv4' && !address.internal) {
        ip = address.address;
      }
    }
  }

  return ip;
};

/**
 * Get the client remote ip address
 *
 * @param {http.ClientRequest} req
 * @param {object} [options]
 * @param {string[]} [options.trusted]
 * @returns {string}
 */
utils.getRemoteIp = function (req, options = {}) {
  let ip = req.connection.remoteAddress || req.socket.remoteAddress;
  let isTrusted = true;
  
  if (!ip) {
    return '';
  }

  const check = ip => {
    if (!options.trusted || !options.trusted.length) {
      return true;
    }

    for (let i = 0; i < options.trusted.length; i++) {
      if (this.isIpEqual(ip, options.trusted[i])) {
        return true;
      }
    }

    return false;
  };
 
  if (ip.match(':')) {
    ip = ip.replace('::1', '127.0.0.1');
    ip.match('.') && (ip = ip.replace(/^::ffff:/, ''));
  }

  if (options.trusted && req.headers['x-forwarded-for']) {
    isTrusted = check(ip);
  }

  if (req.headers['x-forwarded-for'] && isTrusted) {
    const list = req.headers['x-forwarded-for'].split(',').map(ip => ip.trim());
    const proxies = list.slice(1);
    
    if (options.trusted) {
      const matches = proxies.reduce((p, c) => check(c) ? p + 1 : p, 0);
      matches === proxies.length && (ip = list[0]);
    }
    else {
      ip = list[0];
    }
  }

  ip && this.isIpv6(ip) && (ip = this.getFullIpv6(ip));
  return ip;
};

/**
 * Get the ip address (v6) in the full format
 *
 * @param {string} ip
 * @returns {string}
 */
utils.getFullIpv6 = function (ip) {
  return ip6addr.parse(ip).toString({ format: 'v6', zeroElide: false, zeroPad: true });
};

/**
 * Check the ip address is v6
 *
 * @param {string} ip
 * @returns {boolean}
 */
utils.isIpv6 = function (ip) {
  return !!(typeof ip == 'string' && ip.match(':') && validateIP(ip));
};

/**
 * Convert ipv4 to ipv6 format
 *
 * @param {string} ip
 * @returns {string}
 */
utils.ipv4Tov6 = function (ip) {
  return this.getFullIpv6('::ffff:' + ip);
};

/**
 * Check the two ip addresses are equal
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
utils.isIpEqual = function (a, b) {
  return ip6addr.compare(ip6addr.parse(a), ip6addr.parse(b)) == 0;
};

/**
 * Create an address from the hostname and port
 *
 * @param {string} hostname
 * @param {integer} port
 * @returns {string}
 */
utils.createAddress = function (hostname, port) {
  if (this.isIpv6(hostname)) {
    return `[${this.getFullIpv6(hostname)}]:${port}`;
  }

  return `${hostname}:${port}`;
};

/**
 * Check the port is valid
 *
 * @param {string} port
 * @returns {boolean}
 */
utils.isValidPort = function (port) {
  if (!['number', 'string'].includes(typeof port)) {
    return false;
  }

  return +port >= 0 && +port <= 65535;
};

/**
 * Check the ip address is valid
 *
 * @param {string} ip
 * @returns {boolean}
 */
utils.isValidIp = function (ip) {
  return validateIP(ip);
};

/**
 * Check the domain is valid
 *
 * @param {string} domain
 * @returns {boolean}
 */
utils.isValidDomain = function (domain) {
  if (typeof domain != 'string') {
    return false;
  }

  return this.domainValidationRegex.test(domain);
};

/**
 * Check the hostname is valid
 *
 * @param {string} hostname
 * @returns {boolean}
 */
utils.isValidHostname = function (hostname) {
  return this.isValidDomain(hostname) || this.isValidIp(hostname);
};

/**
 * Check the address is valid
 *
 * @param {string} address - address as "ip:port"
 * @returns {boolean}
 */
utils.isValidAddress = function (address) {
  if (!address || typeof address != 'string') {
    return false;
  }

  const parts = this.splitAddress(address);
  const host = parts[0];
  const port = parts[1];
  return this.isValidHostname(host) && this.isValidPort(port);
};

/**
 * Split the address to a hostname and port
 *
 * @param {string} address
 * @returns {string[]}
 */
utils.splitAddress = function (address) {
  let sp;

  if (!address || typeof address != 'string') {
    return [];
  }

  if (address.match(']')) {
    sp = address.split(']:');
    return [this.getFullIpv6(sp[0].slice(1)), +sp[1]];
  }

  sp = address.split(':');
  return [sp[0], +sp[1]];
};

/**
 * Create the data hash
 *
 * @param {string[]} data
 * @return {string}
 */
utils.createDataHash = function (data) {
  return crypto.createHash('md5').update(data.join('+')).digest('hex');
};

/**
 * Get the closest period time
 *
 * @param {integer} time
 * @param {integer} period
 * @return {integer}
 */
utils.getClosestPeriodTime = function (time, period) {
  return Math.floor(time / period) * period;
};

/**
 * Check the string is hex color
 *
 * @param {string} str
 * @return {boolean}
 */
utils.isHexColor = function (str) {
  if (typeof str != 'string') {
    return false;
  }

  return /^#[0-9A-F]{6}$/i.test(str);
};

/**
 * Get a random hex color
 *
 * @return {string}
 */
utils.getRandomHexColor = function () {
  return '#' + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, 0);
};

/**
 * Invert the hex color
 *
 * @return {string}
 */
utils.invertHexColor = function (color) {
  return '#' + (Number(`0x1${color.slice(1)}`) ^ 0xFFFFFF).toString(16).slice(1).toUpperCase();
}

/**
 * Create a request timeout error
 *
 * @returns {Error}
 */
utils.createRequestTimeoutError = function () {
  const err = new Error('Request timed out');
  err.code = 'ERR_SPREADABLE_REQUEST_TIMEDOUT';
  return err;
};

/**
 * Check the error is a request timeout error
 *
 * @param {Error} err
 * @returns {boolean}
 */
utils.isRequestTimeoutError = function (err) {
  if (!(err instanceof Error)) {
    return false;
  }

  return (
    ['ESOCKETTIMEDOUT', 'ETIMEDOUT', 'ERR_SPREADABLE_REQUEST_TIMEDOUT'].includes(err.code) ||
    ['request-timeout', 'body-timeout'].includes(err.type)
  );
};

/**
 * Manage files queue
 */
utils.FilesQueue = class {
  /**
   * @param {string} folderPath
   * @param {object} [options]
   * @param {number} [options.limit]
   * @param {string} [options.ext]
   */
  constructor(folderPath, options = {}) {
    this.folderPath = folderPath;
    this.options = Object.assign({
      limit: 5,
      ext: ''
    }, options);
    this.files = [];
    this.__queue = [];
  }

  /**
   * Initialize the queue
   *
   * @async
   */
  async init() {
    await this.normalize();
  }

  /**
   * Sort the queue
   *
   * @async
   */
  async sort() {
    return this.files.sort((a, b) => a.index - b.index);
  }

  /**
   * Get the file info
   *
   * @async
   * @returns {object}
   */
  async info(filePath) {
    const stat = await fse.stat(filePath);
    const index = parseInt(path.basename(filePath));
    return { filePath, stat, index };
  }

  /**
   * Normalize the queue
   *
   * @async
   */
  async normalize() {
    await fse.ensureDir(this.folderPath);
    this.files = await fse.readdir(this.folderPath);

    for (let i = 0; i < this.files.length; i++) {
      this.files[i] = await this.info(path.join(this.folderPath, this.files[i]));
    }

    if (this.files.length <= this.options.limit) {
      return;
    }

    await this.sort();
    const diff = this.files.length - this.options.limit;
    const excess = this.files.slice(0, diff);
    const rest = this.files.slice(diff);

    for (let i = 0; i < excess.length; i++) {
      const file = excess[i];
      await fse.remove(file.filePath);
      this.files.splice(i, 1);
    }

    for (let i = 0; i < rest.length; i++) {
      const file = rest[i];
      const filePath = path.join(this.folderPath, this.createName(i + 1));
      await fse.rename(file.filePath, filePath);
      this.files[i] = await this.info(filePath);
    }
  }

  /**
   * Run the function blocking the queue
   *
   * @async
   * @param {function} fn
   * @returns {*}
   */
  async blocking(fn) {
    return new Promise((resolve, reject) => {
      const handler = async () => {
        let err;
        let res;

        try {
          res = await fn();
        }
        catch (e) {
          err = e;
        }
        
        err ? reject(err) : resolve(res);
        this.__queue.shift();
        this.__queue.length && this.__queue[0]();
      };
      this.__queue.push(handler);
      this.__queue.length <= 1 && handler();
    });
  }

  /**
   * Get the last item
   *
   * @returns {object|null}
   */
  getLast() {
    return this.files[this.files.length - 1] || null;
  }

  /**
   * Get the first item
   *
   * @returns {object|null}
   */
  getFirst() {
    return this.files[0] || null;
  }

  /**
   * Create a name by the index
   *
   * @param {number} index
   * @returns {string}
   */
  createName(index) {
    return `${index}${this.options.ext ? ('.' + this.options.ext) : ''}`;
  }

  /**
   * Create a new name
   *
   * @returns {string}
   */
  createNewName() {
    const last = this.getLast();
    const index = last ? last.index + 1 : 1;
    return this.createName(index);
  }
};

export default utils;
