const utils = require('./utils');
const _ = require('lodash');
const schema = {};

schema.getAddress = function () {
  return {
    type: 'string',
    value: utils.isValidAddress.bind(utils)
  };
};

schema.getMember = function () {
  return {
    address: this.getAddress(),
    availability: 'number'
  };
};

schema.getMembers = function () {
  return {
    type: 'array',
    items: {
      type: 'object',
      props: this.getMember(),
      strict: true
    }
  }
};

schema.getMembersResponse = function () {
  return this.getMembers();
};

schema.getStatusResponse = function () {
  return {
    type: 'object',
    props: {
      availability: 'number',
      isMaster: 'boolean',
      isNormalized: 'boolean',
      isRegistered: 'boolean',
      networkSize: 'number'
    },
    strict: true
  }
};

schema.getStatusPrettyResponse = function () {
  return _.merge(this.getStatusResponse(), {
    props: {
      availability: 'string'
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
  }
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
          props: {
            address,
            size: 'number'         
          },
          strict: true
        }
      },
      slaves: {
        type: 'array',
        items: {
          type: 'object',
          props: {
            address,
            availability: 'number'      
          },
          strict: true
        }
      },
      backlink: {
        type: 'object',
        props: {
          address,
          chain: {
            type: 'array',
            items: address
          }
        },
        canBeNull: true,
        strict: true
      },
      members: this.getMembers(),
      availability: 'number'
    },
    strict: true
  }
};

schema.getProvideStructureResponse = function () {
  return this.getStructureResponse();
}

schema.getProvideGroupStructureResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      results: {
        type: 'array',
        items: {
          type: 'object',
          canBeNull: false
        }
      }
    },
    strict: true
  }
};

schema.getProvideRegistrationResponse = function() {
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
  }
};

schema.getRegisterResponse = function () {
  const address = this.getAddress();

  return {
    type: 'object',
    props: {
      address,
      size: 'number',
      chain: {
        type: 'array',
        items: address
      }
    },
    strict: true
  }
};

schema.getInterviewSummaryResponse = function() {
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
  }
}

module.exports = schema;