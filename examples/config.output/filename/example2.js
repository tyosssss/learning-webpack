/**
 * example2
 * filename 使用路径作为文件名 , 将文件生成到 output.path的指定目录层级中
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
    filename: 'js/[name].js',
    pathinfo: true
  },

  plugins: [
    new CleanWebpackPlugin(['build'], {
      root: process.cwd(),
      verbose: true,
      dry: false
    })
  ]
}