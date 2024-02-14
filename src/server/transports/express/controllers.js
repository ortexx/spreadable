import compression from "compression";
import express from "express";
import cors from "cors";
import * as errors from "../../../errors.js";
import utils from "../../../utils.js";

export const clientInfo = (node) => {
  return (req, res, next) => {
    const trusted = [...new Set(['127.0.0.1', node.ip, node.externalIp, node.localIp])];
    req.clientIp = utils.getRemoteIp(req, { trusted });
    if (!req.clientIp) {
      return next(new Error(`Client ip address can't be specified`));
    }
    req.clientAddress = req.headers['original-address'] || `${req.clientIp}:0`;
    next();
  };
};
const compression$0 = (node) => compression({ level: node.options.server.compressionLevel });
const cors$0 = () => cors();

export const timeout = () => {
  return (req, res, next) => (req.setTimeout(0), next());
};

export const bodyParser = node => {
  return [
    express.urlencoded({ extended: false, limit: node.options.server.maxBodySize }),
    express.json({ limit: node.options.server.maxBodySize })
  ];
};

export const ping = node => {
  return (req, res) => res.send({
    version: node.getVersion(),
    address: node.address
  });
};

export const status = node => {
  return async (req, res, next) => {
    try {
      res.send(await node.getStatusInfo(req.query.pretty !== undefined));
    }
    catch (err) {
      next(err);
    }
  };
};

export const indexPage = () => {
  return (req, res) => res.send({ success: true });
};

export const notFound = () => {
  return (req, res, next) => next(new errors.NotFoundError(`Not found route "${req.originalUrl}"`));
};

export const handleErrors = node => {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err instanceof errors.WorkError) {
      res.status(422);
      return res.send({ message: err.message, code: err.code || 'ERR_SPREADABLE_API' });
    }
    if (err.statusCode) {
      res.status(err.statusCode);
      return res.send({ message: err.message });
    }
    node.logger.error(err.stack);
    res.status(500);
    res.send({ message: err.message });
  };
};

export { compression$0 as compression };

export { cors$0 as cors };
