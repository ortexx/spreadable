import path from "path";
import _ from "lodash";
import config from "./webpack.common.js";
import { URL } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;

export default (options = {}, wp) => {
    options = _.merge({
        name: 'client',
        include: [],
        mock: {
            "chalk": true,
            "ip6addr": true,
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
