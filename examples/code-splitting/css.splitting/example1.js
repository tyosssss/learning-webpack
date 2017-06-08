const { resolve, join } = require('path')
const webpack = require('webpack')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const SRC_PATH = resolve('src')
const OUTPUT_PATH = resolve('build')

module.exports = {
  context: SRC_PATH,

  entry: {
    main: './main.js'
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        // use: ['style-loader', 'css-loader']
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: "css-loader"
        })
      }
    ]
  },

  output: {
    filename: '[name].js',
    path: OUTPUT_PATH
  },

  plugins: [
    new ExtractTextPlugin('styles/styles.css'),
    new CleanWebpackPlugin(['build'], {
      root: process.cwd(),
      verbose: true,
      dry: false,
    })
  ]
}