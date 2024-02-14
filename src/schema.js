import utils from "./utils.js";
import merge from "lodash-es/merge.js";

const schema = {};

schema.getAddress = function () {
  return {
    type: 'string',
    value: utils.isValidAddress.bind(utils)
  };
};

schema.getClientIp = function () {
  return {
    type: 'string',
    value: utils.isValidIp.bind(utils)
  };
};

schema.getApprovers = function () {
  return {
    type: 'array',
    uniq: true,
    items: this.getAddress()
  };
};

schema.getStatusResponse = function () {
  return {
    type: 'object',
    props: {
      root: 'string',
      availability: 'number',
      syncAvgTime: 'number',
      isMaster: 'boolean',
      isNormalized: 'boolean',
      isRegistered: 'boolean',
      networkSize: 'number'
    },
    strict: true
  };
};

schema.getStatusPrettyResponse = function () {
  return merge(this.getStatusResponse(), {
    props: {
      availability: 'string',
      syncAvgTime: 'string'
    }
  });
};

schema.getAvailableNodeResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress()
    },
    strict: true
  };
};

schema.getRequestApprovalKeyResponse = function () {
  return {
    type: 'object',
    props: {
      key: 'string',
      startedAt: 'number',
      clientIp: this.getClientIp(),
      approvers: this.getApprovers()
    },
    strict: true
  };
};

schema.getStructureResponse = function () {
  const address = this.getAddress();
  return {
    type: 'object',
    props: {
      address,
      masters: {
        type: 'array',
        items: {
          type: 'object',
          uniq: 'address',
          props: {
            address,
            size: 'number'
          },
          strict: true
        }
      },
      slaves: {
        type: 'array',
        uniq: 'address',
        items: {
          type: 'object',
          props: {
            address
          },
          strict: true
        }
      },
      backlink: {
        type: 'object',
        props: {
          address
        },
        canBeNull: true,
        strict: true
      }
    },
    strict: true
  };
};

schema.getProvideRegistrationResponse = function () {
  const address = this.getAddress();
  return {
    type: 'object',
    props: {
      address,
      networkSize: 'number',
      syncLifetime: 'number',
      results: {
        type: 'array',
        items: {
          type: 'object',
          props: {
            networkSize: 'number',
            address,
            candidates: {
              type: 'array',
              uniq: 'address',
              items: {
                type: 'object',
                props: {
                  address
                },
                strict: true
              }
            }
          },
          strict: true
        }
      }
    },
    strict: true
  };
};

schema.getRegisterResponse = function () {
  const address = this.getAddress();
  return {
    type: 'object',
    props: {
      address,
      size: 'number'
    },
    strict: true
  };
};

schema.getInterviewSummaryResponse = function () {
  const address = this.getAddress();
  return {
    type: 'object',
    props: {
      address,
      summary: {
        type: 'object',
        props: {
          address
        },
        strict: true
      }
    },
    strict: true
  };
};

schema.getApprovalApproverInfoResponse = function (infoSchema) {
  const address = this.getAddress();
  return {
    type: 'object',
    props: {
      address,
      info: infoSchema
    },
    strict: true
  };
};

schema.getApprovalInfoRequest = function (answerSchema) {
  return {
    type: 'object',
    props: {
      action: 'string',
      key: 'string',
      startedAt: 'number',
      clientIp: this.getClientIp(),
      approvers: this.getApprovers(),
      answer: answerSchema
    },
    strict: true
  };
};

export default schema;
