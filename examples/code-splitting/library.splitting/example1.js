const { resolve, join } = require('path')
const webpack = require('webpack')
const { CommonsChunkPlugin } = webpack.optimize
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = resolve('src')
const OUTPUT_PATH = resolve('build')

module.exports = {
  context: SRC_PATH,

  entry: {
    main: './main.js',
    vendor: ['./utils/1', './utils/2']
  },

  output: {
    filename: '[name].[chunkhash].js',
    path: OUTPUT_PATH
  },

  plugins: [
    new CleanWebpackPlugin(['build'], {
      root: process.cwd(),
      verbose: true,
      dry: false,
    }),

    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor'
    }),

    new CommonsChunkPlugin({
      // names: ['vendor', 'manifest']
      name: 'manifest'
    })
  ]
}