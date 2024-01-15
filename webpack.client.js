import path from "path";
import _ from "lodash";
import config from "./webpack.common.js";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default (options = {}, wp) => {
    options = _.merge({
        name: 'client',
        include: [],
        mock: {
            "fs-extra": true,
            "chalk": true,
            "ip6addr": true,
            "qiao-get-ip": true,
            "tcp-port-used": true,
            "validate-ip-node": true,
            "crypto": true,
            "path": true,
            "stream": true
        }
    }, options);
    options.include.push([path.resolve(__dirname, 'src/browser/client')]);
    return wp ? config(options, wp) : options;
};
