const path = require('path');
const merge = require('lodash/merge');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

module.exports = (options = {}) => {
  const pack = require(options.packagePath || path.join(process.cwd(), 'package.json'));
  const banner = options.banner || `${pack.name} client\n@version ${pack.version}\n{@link ${pack.homepage}}`;
  const plugins = options.plugins || [];
  const BannerPlugin = new webpack.BannerPlugin({ banner });
  plugins.push(BannerPlugin);

  const mock = merge({
    "os": true,
    "crypto": true,
    "chalk": true,
    "ip6address": true,    
    "external-ip": true,
    "tcp-port-used": true,
    "validate-ip-node": true,
    "lookup-dns-cache": true
  }, options.mock);
  
  const include = [path.resolve(__dirname, 'src/browser/client')].concat(options.include || []);
  const mockIndexPath = options.mockIndexPath || path.resolve(__dirname, 'src/browser/client/mock');
  const isProd = options.isProd === undefined? process.env.NODE_ENV == 'production': options.isProd;  
  const alias = options.alias || {};
  const node = options.node || {};
  const entry = {};
  entry[`${pack.name}.client`] = options.entry || path.resolve(process.cwd(), 'src/browser/client');

  for(let key in mock) {
    const val = mock[key];

    if(val === false) {
      continue; 
    }

    alias[key] = val === true? mockIndexPath: val;
  }

  return {
    mode: isProd? 'production': 'development',
    performance: { hints: false },
    watch: !isProd,
    bail: true,
    devtool: isProd? false: 'inline-source-map',
    entry,
    output: {
      path: options.distPath || path.join(process.cwd(), '/dist'),
      filename: '[name].js',
      library: options.library || ('Client' + pack.name[0].toUpperCase() + pack.name.slice(1)),      
      libraryTarget: 'umd'
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          extractComments: false
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
          query: {
            presets: ['env'],
            plugins: ['transform-runtime']
          }
        }
      ]    
    },
    resolve: {
      alias
    },
    node: merge({
      fs: 'empty',
      dns: 'empty',
      net: 'empty',
      tls: 'empty',
      url: 'empty',
      setImmediate: 'empty'
    }, node)
  };
};