import * as errors from "../../../errors.js";
import utils from "../../../utils.js";
import schema from "../../../schema.js";
import { merge, intersection } from "lodash-es";
import crypto from "crypto";
import Cookies from "cookies";
import basicAuth from "basic-auth";

const midds = {};

/**
 * Handle the approval request
 */
midds.approval = node => {
  return async (req, res, next) => {
    try {
      const invErrCode = 'ERR_SPREADABLE_INVALID_APPROVAL_INFO';
      const timeout = node.createRequestTimeout(req.body);
      const timer = node.createRequestTimer(timeout);
      let info = req.body.approvalInfo || req.query.approvalInfo;
      
      if (!info) {
        throw new errors.WorkError(`Request to "${req.originalUrl}" requires confirmation`, 'ERR_SPREADABLE_APPROVAL_INFO_REQUIRED');
      }

      try {
        typeof info == 'string' && (info = JSON.parse(info));
      }
      catch (err) {
        throw new errors.WorkError(err.message, invErrCode);
      }

      const action = info.action;
      const startedAt = info.startedAt;
      const key = info.key;
      const clientApprovers = info.approvers;
      const clientIp = info.clientIp;
      const answer = info.answer;
      await node.approvalActionTest(action);
      const approval = await node.getApproval(action);
      await approval.startTimeTest(startedAt);
      const answerSchema = approval.getClientAnswerSchema();

      try {
        utils.validateSchema(schema.getApprovalInfoRequest(answerSchema), info);
      }
      catch (err) {
        throw new errors.WorkError(err.message, invErrCode);
      }

      const time = utils.getClosestPeriodTime(startedAt, approval.period);
      const approversCount = await approval.calculateApproversCount();
      let approvers = await node.getApprovalApprovers(time, approversCount, { timeout: timer() });
      const targets = intersection(clientApprovers, approvers).map(address => ({ address }));
      await approval.approversDecisionCountTest(targets.length);
      const results = await node.requestGroup(targets, 'check-approval-answer', {
        includeErrors: false,
        timeout: timer(await node.getRequestServerTimeout()),
        body: { key, answer, approvers: clientApprovers, clientIp }
      });

      try {
        await approval.approversDecisionCountTest(results.length);
      }
      catch (err) {
        throw new errors.WorkError('Wrong answer, try again', 'ERR_SPREADABLE_WRONG_APPROVAL_ANSWER');
      }

      req.approvalInfo = info;
      next();
    }
    catch (err) {
      next(err);
    }
  };
};

/**
 * Update the client info
 */
midds.updateClientInfo = node => {
  return async (req, res, next) => {
    try {
      await node.db.successServerAddress(req.clientAddress);
      next();
    }
    catch (err) {
      next(err);
    }
  };
};

/**
 * Control the current request client access
 */
midds.networkAccess = (node, checks = {}) => {
  checks = merge({
    auth: true,
    root: false,
    address: false,
    version: false
  }, checks);
  return async (req, res, next) => {
    try {
      await node.addressFilter(req.clientAddress);
      await node.networkAccess(req);

      if (checks.address &&
        (!utils.isValidAddress(req.clientAddress) ||
        !utils.isIpEqual(await utils.getAddressIp(req.clientAddress), req.clientIp))
      ) {
        throw new errors.AccessError(`Wrong address "${req.clientAddress}"`);
      }

      if (checks.auth && node.options.network.auth) {
        const auth = node.options.network.auth;
        const cookies = new Cookies(req, res);
        const cookieKey = `spreadableNetworkAuth[${node.address}]`;
        const cookieKeyValue = cookies.get(cookieKey);
        const info = basicAuth(req);
        const cookieInfo = cookieKeyValue ? JSON.parse(Buffer.from(cookieKeyValue, 'base64')) : null;
        const behaviorFail = await node.getBehavior('authentication');

        if (
          (!cookieInfo || cookieInfo.username != auth.username || cookieInfo.password != auth.password) &&
          (!info || info.name != auth.username || info.pass != auth.password)
        ) {
          res.setHeader('WWW-Authenticate', `Basic realm="${node.address}"`);
          behaviorFail.add(req.clientAddress);
          throw new errors.AuthError('Authentication is required');
        }

        behaviorFail.sub(req.clientAddress);

        if (!cookieKeyValue) {
          cookies.set(cookieKey, Buffer.from(JSON.stringify(auth)).toString('base64'), {
            maxAge: node.options.network.authCookieMaxAge,
            httpOnly: false
          });
        }
      }

      if (checks.version) {
        const version = node.getVersion();
        const current = req.headers['node-version'] || req.headers['client-version'];

        if (current !== undefined && current != version) {
          throw new errors.AccessError(`The version is different: "${current}" instead of "${version}"`);
        }
      }

      if (checks.root) {
        const root = node.getRoot();
        if (req.headers['node-root'] != root) {
          throw new errors.AccessError(`Node root is different: "${req.headers['node-root']}" instead of "${root}"`);
        }
      }

      next();
    }
    catch (err) {
      next(err);
    }
  };
};

/**
 * Control the client requests queue
 */
midds.requestQueueClient = (node, options = {}) => {
  options = merge({
    limit: node.options.request.clientConcurrency
  }, options);
  return (req, res, next) => {
    const key = options.key || (req.method + req.originalUrl.split('?')[0]);
    delete options.key;
    return midds.requestQueue(node, key, options)(req, res, next);
  };
};

/**
 * Control parallel requests queue
 */
midds.requestQueue = (node, keys, options) => {
  options = merge({
    limit: 1,
    fnHash: key => crypto.createHash('md5').update(key).digest("hex")
  }, options);
  return async (req, res, next) => {
    const createPromise = key => {
      return new Promise((resolve, reject) => {
        key = typeof key == 'function' ? key(req) : key;
        const hash = options.fnHash(key);
        const obj = node.__requestQueue;

        if (!hash) {
          throw new errors.WorkError('"hash" is invalid', 'ERR_SPREADABLE_INVALID_REQUEST_QUEUE_HASH');
        }

        (!obj[hash] || !obj[hash].length) && (obj[hash] = []);
        const arr = obj[hash];
        let finished = false;
        const finishFn = () => {
          try {
            if (finished) {
              return;
            }

            finished = true;
            req.removeListener('close', finishFn);
            res.removeListener('finish', finishFn);
            const index = arr.findIndex(it => it.req == req);

            if (index >= 0) {
              arr.splice(index, 1);
              arr[options.limit - 1] && arr[options.limit - 1].startFn();
            }

            !arr.length && delete obj[hash];
          }
          catch (err) {
            reject(err);
          }
        };
        const startFn = resolve;
        req.on('close', finishFn);
        res.on('finish', finishFn);
        arr.push({ req, startFn });
        arr.length <= options.limit && startFn();
      });
    };
    try {
      !Array.isArray(keys) && (keys = [keys]);
      keys = [...new Set(keys)].filter(it => it);
      const promise = [];

      for (let i = 0; i < keys.length; i++) {
        promise.push(createPromise(keys[i]));
      }
      
      await Promise.all(promise);
      next();
    }
    catch (err) {
      next(err);
    }
  };
};

export default midds;
