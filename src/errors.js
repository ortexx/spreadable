export class WorkError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 401;
  }
}

export class AccessError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 403;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 404;
  }
}