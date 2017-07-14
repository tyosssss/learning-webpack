const path = require('path')
const webpack = require("../../../webpack-2.6.1")
const fs = require('fs')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = path.resolve(__dirname, 'src')
const DIST_PATH = path.resolve(__dirname, 'build')


/**
 * 
 * Common
 *  M1
 *  M2
 *  M3
 * 
 * 
 * Config
 *  M4
 *  M5
 * 
 *  A
 *    M1
 *    M4
 *    M7
 *  B
 *    M2
 *    M6
 * 
 * 目标 : 
 * 将Common用的和业务块用到的模块M1,M2 ==> Common
 */
let referenced = {}

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
    (function () {
      return {
        apply(compiler) {
          compiler.plugin('this-compilation', function (compilation) {
            compilation.plugin('optimize-chunks-basic', function (chunks) {
              let chunk = chunks.find(c => c.name == "Common")

              if (chunk) {
                chunk.modules.forEach(m => {
                  m.rawRequest && (referenced[m.rawRequest] = 1)
                })
              }
            })
          })
        }
      }
    })(),


    new webpack.optimize.CommonsChunkPlugin({
      names: ['Common'],
      chunks: ['A', 'B', 'Config'],
      minChunks: function (module, count) {
        return module.rawRequest && referenceed[module.rawRequest]
      }
    })
  ]
}