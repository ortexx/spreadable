export const getAvailableNode = node => {
  return async (req, res, next) => {
    try {
      const address = await node.getAvailableNode(node.prepareClientMessageOptions(req.body));
      res.send({ address });
    }
    catch (err) {
      next(err);
    }
  };
};

export const requestApprovalKey = node => {
  return async (req, res, next) => {
    try {
      const action = req.body.action;
      const options = node.prepareClientMessageOptions(req.body);
      const result = await node.requestApprovalKey(action, req.clientIp, options);
      res.send(result);
    }
    catch (err) {
      next(err);
    }
  };
};

export const requestApprovalQuestion = node => {
  return async (req, res, next) => {
    try {
      const action = req.body.action;
      const key = req.body.key;
      const info = req.body.info;
      const confirmedAddresses = req.body.confirmedAddresses;
      const options = node.prepareClientMessageOptions(req.body);
      const question = await node.requestApprovalQuestion(action, req.clientIp, key, info, confirmedAddresses, options);
      res.send({ question });
    }
    catch (err) {
      next(err);
    }
  };
};

export const addApprovalInfo = node => {
  return async (req, res, next) => {
    try {
      const action = req.body.action;
      const key = req.body.key;
      const info = req.body.info;
      const startedAt = req.body.startedAt;
      await node.addApprovalInfo(action, req.clientIp, key, startedAt, info);
      res.send({ success: true });
    }
    catch (err) {
      next(err);
    }
  };
};
