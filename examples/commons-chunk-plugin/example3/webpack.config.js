const path = require('path')
const webpack = require("../../../webpack-2.6.1")
const fs = require('fs')
// const NyanProgressPlugin = require('nyan-progress-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = path.resolve(__dirname, 'src')
const DIST_PATH = path.resolve(__dirname, 'build')

module.exports = {
  context: path.resolve(SRC_PATH),
  stats:{
    chunks:true
  },

  entry: {
    A:['./A.js'],
    E:['./E.js'],
    Common:'./Common.js'
  },

  output: {
    filename: '[name].js',
    chunkFilename: "[name].js",
    path: DIST_PATH
  },

  plugins: [
    // new NyanProgressPlugin(),
    new CleanWebpackPlugin(['build'], {
      root: path.resolve(__dirname),
      verbose: true
    }),

    /**
     * 将入口块和入口块的子块中的所有公共模块提取到Common中
     * 
     * 提取策略 : 
     * 1. 将A,E中的异步块中的公共模块 , 提取到 A,E 中
     *  name = A : B,C --> M5 提取到 Common
     *  name = E : F,G --> M5 提取到 Common
     * 
     * 2. 将所有入口模块(A,E)中的公共模块 , 提取到Common
     *  name A,E --> M1 , M2 , M3 , M5
     */
    new webpack.optimize.CommonsChunkPlugin({
      names: ['A','E'],
      children:true
      // async:"Common"
    }),
    
    new webpack.optimize.CommonsChunkPlugin({
      names: ['Common'],
      filename:'a.b.c.js'
    }),
  ]
}