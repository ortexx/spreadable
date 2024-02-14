import path from "path";
import { fileURLToPath } from "url";
import merge from "lodash-es/merge.js";
import config from "./webpack.common.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (options = {}, wp) => {
  options = merge(
    {
      name: "client",
      include: [],
      mock: {
        "fs-extra": true,
        chalk: true,
        ip6addr: true,
        "tcp-port-used": true,
        "validate-ip-node": true,
        crypto: true,
        path: true,
        stream: true
      },
    },
    options
  );
  options.include.push([path.resolve(__dirname, "src/browser/client")]);
  return wp? config(options, wp) : options;
};
