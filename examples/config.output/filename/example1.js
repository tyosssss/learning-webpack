/**
 * example1
 * 使用 [name]
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
    filename: '[name].js'
  },

  plugins: [
    new CleanWebpackPlugin(['build'], {
      root: process.cwd(),
      verbose: true,
      dry: false
    })
  ]
}