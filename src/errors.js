module.exports.WorkError = class WorkError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
};

module.exports.AuthError = class AuthError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 401;
  }
};

module.exports.AccessError = class AccessError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 403;
  }
};

module.exports.NotFoundError = class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 404;
  }
};
