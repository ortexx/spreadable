'use strict';

const { exec } = require('child_process');

class Dig {
    constructor(domain, record) {
        this.domain = domain;
        this.record = record;
        this.cmd = `dig +nocmd ${this.domain} ${this.record} +noall +answer +short`;
    }

    lookup() {
        const self = this;
        return new Promise(( resolve, reject ) => {
            exec(self.cmd, (error, stdout, stderr) => {
                if(error || stderr) {
                    reject('DNS lookup failed');
                }
                resolve(stdout);
            });
        });
    }
}

module.exports = Dig;