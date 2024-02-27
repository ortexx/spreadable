import CssMinimizerPlugin from "css-minimizer-webpack-plugin";
import ESLintPlugin from "eslint-webpack-plugin";
import fse from "fs-extra";
import  { merge, capitalize } from "lodash-es";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";
import path from "path";
import TerserPlugin from "terser-webpack-plugin";
import { fileURLToPath } from "url";
import webpack from "webpack";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (options = {}) => {
  const cwd = process.cwd();
  const name = options.name || "build";
  const pack = JSON.parse(
    fse.readFileSync(
      new URL(
        options.packagePath || path.join(cwd, "package.json"),
        import.meta.url
      )
    )
  );
  pack.name = pack.name.split("-")[0] || pack.name;
  const banner = options.banner || `${pack.name} ${name}\n@version ${pack.version}\n{@link ${pack.homepage}}`;
  let plugins = [];
  plugins.push(new webpack.BannerPlugin({ banner }));
  plugins.push(new MiniCssExtractPlugin({ filename: "style.css" }));
  plugins.push(new NodePolyfillPlugin());
  plugins.push(new ESLintPlugin({ exclude: ["node_modules", "dist"] }));
  plugins = plugins.concat(options.plugins || []);
  const mock = merge(
    {
      https: true,
      http: true,
      net: true,
      tls: true,
      os: true,
      "fs-extra": true,
      fs: true,
      dns: true,
    },
    options.mock
  );
  const include = options.include || [];
  const mockIndexPath = options.mockIndexPath || path.resolve(__dirname, "src/browser/mock");
  const isProd = options.isProd === undefined? process.env.NODE_ENV == "production": options.isProd;
  const alias = options.alias || {};
  const entry = {};
  const mainEntry = options.entry || path.resolve(cwd, `src/browser/${name}`);
  entry[`${pack.name}.${name}`] = mainEntry;

  for (let key in mock) {
    const val = mock[key];

    if (val === false) {
      continue;
    }

    alias[key] = val === true? mockIndexPath : val;
  }

  return merge(
    {
      mode: isProd? "production" : "development",
      performance: { hints: false },
      watch: !isProd,
      devtool: isProd? false : "inline-source-map",
      entry,
      output: {
        path: options.distPath || path.join(cwd, `/dist/${name}`),
        filename: "[name].js",
        library: options.library || capitalize(name) + capitalize(pack.name),
        libraryTarget: "umd",
        libraryExport: "default",
        clean: true,
      },
      optimization: {
        minimizer: [
          new TerserPlugin({
            extractComments: false,
          }),
          new CssMinimizerPlugin({
            minimizerOptions: {
              preset: [
                "default",
                {
                  mergeRules: false,
                },
              ],
            },
          }),
        ],
      },
      plugins,
      module: {
        rules: [
          {
            test: /\.js$/,
            loader: "babel-loader",
            exclude: /node_modules/,
            include,
            options: {
              configFile: path.join(mainEntry, ".babelrc"),
            },
          },
          {
            test: /\.html$/,
            loader: "html-loader",
            options: {
              esModule: false,
              minimize: {
                removeScriptTypeAttributes: false,
              },
            },
          },
          {
            test: /\.s?css$/,
            use: [
              MiniCssExtractPlugin.loader,
              "css-loader",
              "resolve-url-loader",
              {
                loader: "sass-loader",
                options: {
                  sourceMap: true,
                },
              },
            ],
          },
          {
            test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
            type: 'asset/resource',
            dependency: { not: ['url'] }
          },
        ],
      },
      resolve: {
        alias
      }
    },
    options.config
  );
};
