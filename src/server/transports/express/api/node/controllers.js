import * as errors from "../../../../../errors.js";
import utils from "../../../../../utils.js";
import schema from "../../../../../schema.js";
import { pick } from "lodash-es";

export const register = node => {
  return async (req, res, next) => {
    try {
      const target = req.body.target;

      if (
        target == node.address ||
        !utils.isValidAddress(target) ||
        !utils.isIpEqual(await utils.getHostIp(utils.splitAddress(target)[0]), req.clientIp)
      ) {
        throw new errors.WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      }

      let size = await node.db.getSlavesCount();

      if (await node.db.hasSlave(target)) {
        return res.send({ size });
      }

      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      let result;
      
      try {
        result = await node.requestNode(target, 'get-interview-summary', {
          timeout: timer(),
          responseSchema: schema.getInterviewSummaryResponse()
        });
      }
      catch (err) {
        node.logger.warn(err.stack);
        throw new errors.WorkError('Interviewee unavailable', 'ERR_SPREADABLE_INTERVIEW_INTERVIEWEE_NOT_AVAILABLE');
      }

      if (!result.summary || typeof result.summary != 'object') {
        throw new errors.WorkError('Interviewee sent invalid summary', 'ERR_SPREADABLE_INTERVIEW_INVALID_SUMMARY');
      }

      await node.interview(result.summary);
      await node.db.addSlave(target);
      size++;
      res.send({ size });
    }
    catch (err) {
      next(err);
    }
  };
};

export const structure = node => {
  return async (req, res, next) => {
    try {
      return res.send(await node.createStructure());
    }
    catch (err) {
      next(err);
    }
  };
};

export const getInterviewSummary = node => {
  return async (req, res, next) => {
    try {
      return res.send({ summary: await node.getInterviewSummary() });
    }
    catch (err) {
      next(err);
    }
  };
};

export const provideRegistration = node => {
  return async (req, res, next) => {
    try {
      const target = req.body.target;

      if (!utils.isValidAddress(target)) {
        throw new errors.WorkError('"target" field is invalid', 'ERR_SPREADABLE_INVALID_TARGET_FIELD');
      }

      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      let masters = await node.db.getMasters();
      !masters.length && (masters = [{ address: node.address }]);
      let results = await node.requestGroup(masters, 'structure', { timeout: timer() });

      for (let i = results.length - 1; i >= 0; i--) {
        const result = results[i];
        if (!result.slaves.length && result.address != node.address) {
          results.splice(i, 1);
          continue;
        }
        let info = {};
        info.address = result.address;
        info.networkSize = await node.getNetworkSize(result.masters);
        info.candidates = result.slaves.length ? result.slaves.map(s => pick(s, ['address'])) : [{ address: node.address }];
        results[i] = info;
      }

      const syncLifetime = await node.getSyncLifetime();
      const networkSize = await node.getNetworkSize();
      res.send({ results, syncLifetime, networkSize });
    }
    catch (err) {
      next(err);
    }
  };
};

export const getApprovalInfo = node => {
  return async (req, res, next) => {
    try {
      const action = req.body.action;
      const key = req.body.key;
      await node.approvalActionTest(action);
      const approval = await node.getApproval(action);
      const approver = await node.db.getApproval(key);

      if (!approver) {
        throw new errors.WorkError(`Unsuitable approval key "${key}"`, 'ERR_SPREADABLE_UNSUITABLE_APPROVAL_KEY');
      }

      const result = await approval.createInfo(approver);
      await node.db.startApproval(key, result.answer);
      res.send({ info: result.info });
    }
    catch (err) {
      next(err);
    }
  };
};

export const checkApprovalAnswer = node => {
  return async (req, res, next) => {
    try {
      const answer = req.body.answer;
      const key = req.body.key;
      const clientIp = req.body.clientIp;
      const approvers = req.body.approvers;
      const approver = await node.db.getApproval(key);

      if (!approver || approver.usedBy.includes(req.clientAddress) || !utils.isIpEqual(approver.clientIp, clientIp)) {
        throw new errors.WorkError(`Unsuitable approval key "${key}"`, 'ERR_SPREADABLE_UNSUITABLE_APPROVAL_KEY');
      }

      const approval = await node.getApproval(approver.action);
      const result = await approval.checkAnswer(approver, answer, approvers);
      await node.db.useApproval(key, req.clientAddress);

      if (!result) {
        throw new errors.WorkError(`Wrong approval answer`, 'ERR_SPREADABLE_WRONG_APPROVAL_ANSWER');
      }
      
      res.send({ success: true });
    }
    catch (err) {
      next(err);
    }
  };
};
