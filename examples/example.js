const { resolve, join } = require('path')
const webpack = require('webpack')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = resolve('src')
const OUTPUT_PATH = resolve('build')

module.exports = {
  context: SRC_PATH,

  entry: {
    main: './main.js'
  },

  output: {
    filename: '[name].js',
    path: OUTPUT_PATH
  },

  plugins: [
    new CleanWebpackPlugin(['build'], {
      root: process.cwd(),
      verbose: true,
      dry: false,
    })
  ]
}