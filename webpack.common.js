import path from "path";
import _ from "lodash";
import TerserPlugin from "terser-webpack-plugin";
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";
import CssMinimizerPlugin from "css-minimizer-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import ESLintPlugin from "eslint-webpack-plugin";
import webpack from "webpack";
import fse from "fs-extra"
import { URL } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;

export default (options = {}) => {
    const cwd = process.cwd();
    const name = options.name || 'build';
    const pack = JSON.parse(fse.readFileSync(new URL(options.packagePath || path.join(cwd, 'package.json'), import.meta.url)));
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
        "fs": true,
        "dns": true,
    }, options.mock);
    const include = options.include || [];
    const mockIndexPath = options.mockIndexPath || path.resolve(__dirname, 'src/browser/mock');
    const isProd = options.isProd === undefined ? process.env.NODE_ENV == 'production' : options.isProd;
    const alias = options.alias || {};
    const entry = {};
    const mainEntry = options.entry || path.resolve(cwd, `src/browser/${name}`);
    entry[`${pack.name}.${name}`] = mainEntry;
    for (let key in mock) {
        const val = mock[key];
        if (val === false) {
            continue;
        }
        alias[key] = val === true ? mockIndexPath : val;
    }
    return _.merge({
        mode: isProd ? 'production' : 'development',
        performance: { hints: false },
        watch: !isProd,
        devtool: isProd ? false : 'inline-source-map',
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
