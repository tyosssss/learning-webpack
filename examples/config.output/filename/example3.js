/**
 * example2
 * 使用指定长度的内容hash
 */
const { resolve, join } = require('path')
const webpack = require("webpack")
const fs = require('fs')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = resolve('src')
const DIST_PATH = resolve('build')

module.exports = {
  context: SRC_PATH,

  entry: './main.js',

  output: {
    path: resolve('build'),
    filename: '[chunkhash:5].js',
    pathinfo: true
  },

  hashDigestLength: 5,

  plugins: [
    new CleanWebpackPlugin(['build'], {
      root: process.cwd(),
      verbose: true,
      dry: false
    })
  ]
}