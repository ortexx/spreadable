const path = require('path');
const _ = require('lodash');
const TerserPlugin = require('terser-webpack-plugin');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ESLintPlugin = require('eslint-webpack-plugin');
const webpack = require('webpack');

module.exports = (options = {}) => {
  const cwd = process.cwd();
  const name = options.name || 'build';  
  const pack = require(options.packagePath || path.join(cwd, 'package.json'));
  const banner = options.banner || `${pack.name} ${name}\n@version ${pack.version}\n{@link ${pack.homepage}}`;
  let plugins = [];
  plugins.push(new webpack.BannerPlugin({ banner }));
  plugins.push(new MiniCssExtractPlugin({ filename: 'style.css' }));
  plugins.push(new NodePolyfillPlugin());  
  plugins.push(new ESLintPlugin({ exclude: ['node_modules', 'dist'] }));
  plugins = plugins.concat(options.plugins || []);
  const mock = _.merge({
    "https": true,
    "http": true,
    "net": true,
    "tls": true,
    "os": true,
    "dns": true,
  }, options.mock);  
  const include = options.include || [];
  const mockIndexPath = options.mockIndexPath || path.resolve(__dirname, 'src/browser/mock');
  const isProd = options.isProd === undefined? process.env.NODE_ENV == 'production': options.isProd;  
  const alias = options.alias || {};
  const entry = {};
  const mainEntry =  options.entry || path.resolve(cwd, `src/browser/${name}`);
  entry[`${pack.name}.${name}`] = mainEntry;

  for(let key in mock) {
    const val = mock[key];

    if(val === false) {
      continue; 
    }

    alias[key] = val === true? mockIndexPath: val;
  }

  return _.merge({
    mode: isProd? 'production': 'development',
    performance: { hints: false },
    watch: !isProd,
    devtool: isProd? false: 'inline-source-map',
    entry,
    output: {
      path: options.distPath || path.join(cwd, `/dist/${name}`),
      filename: '[name].js',
      library: options.library || (_.capitalize(name) + _.capitalize(pack.name)),
      libraryTarget: 'umd',
      clean: true
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          extractComments: false
        }),
        new CssMinimizerPlugin({
          minimizerOptions: {
            preset: [
              'default',
              {
                mergeRules: false
              }
            ]
          }
        })
      ]
    },
    plugins,
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          include,
          options: {
            configFile: path.join(mainEntry, '.babelrc')           
          }
        },
        {
          test: /\.html$/,
          loader: 'html-loader',
          options: {
            esModule: false,
            minimize: {
              removeScriptTypeAttributes: false
            }
          }
        },
        {
          test: /\.s?css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'resolve-url-loader',
            {
              loader: 'sass-loader',
              options: {
                sourceMap: true
              }
            }
          ]
        },
        {
          test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
          loader: 'file-loader',
          options: {
            esModule: false,
            name: '[name].[ext]'
          }
        }
      ] 
    },
    resolve: {
      alias      
    }
  }, options.config);
};