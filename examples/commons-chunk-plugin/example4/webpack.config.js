const path = require('path')
const webpack = require("../../../webpack-2.6.1")
const fs = require('fs')
// const NyanProgressPlugin = require('nyan-progress-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = path.resolve(__dirname, 'src')
const DIST_PATH = path.resolve(__dirname, 'build')


/**
 * 
 * Common
 *  M1
 *  M2
 * 
 * 
 * Config
 *  M4
 *  M5
 *  M123 ( M1 , M2 , M3 )
 * 
 *  A
 *    M1
 *    M4
 *    M7
 *  B
 *    M3
 * 
 * 目标 : 将公共模块"M123" 以及 它引用1,2,3 ==> Common
 */

module.exports = {
  context: path.resolve(SRC_PATH),
  stats: {
    chunks: true
  },

  entry: {
    Config: ['./Config.js'],
    // E:['./E.js'],
    Common: './Common.js'
  },

  output: {
    filename: '[name].js',
    chunkFilename: "[name].js",
    path: DIST_PATH
  },

  plugins: [
    // new NyanProgressPlugin(),
    // new CleanWebpackPlugin(['build'], {
    //   root: path.resolve(__dirname),
    //   verbose: true
    // }),

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
    // new webpack.optimize.CommonsChunkPlugin({
    //   names: ['A','E'],
    //   children:true
    //   // async:"Common"
    // }),

    (function () {
      let referenced = {}

      return new webpack.optimize.CommonsChunkPlugin({
        names: ['Common'],
        chunks: ['Config'],
        minChunks: function (module, count) {
          let extracted = module.rawRequest === './67'

          if (extracted) {
            module.dependencies.some(d => {
              if (d.module) {
                referenced[d.module.identifier()] = 1
              }
            })

            return true
          } else {
            return !!referenced[module.identifier()]
          }
        }
      })
    })(),
  ]
}