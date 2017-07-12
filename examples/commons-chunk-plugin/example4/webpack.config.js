const path = require('path')
const webpack = require("../../../webpack-2.6.1")
const fs = require('fs')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = path.resolve(__dirname, 'src')
const DIST_PATH = path.resolve(__dirname, 'build')

console.log(SRC_PATH)

module.exports = {
  context: path.resolve(SRC_PATH),

  entry: {
    // a: './a.js',
    // b: './b.js',
    // jquery: ['./jquery']
    main: './main.js',
    // common: './jquery.js'
  },

  output: {
    filename: '[name].js',
    chunkFilename: "[name].js",
    path: DIST_PATH
  },

  plugins: [
    new CleanWebpackPlugin(['build'], {
      root: path.resolve(__dirname),
      verbose: true,
      dry: true,
      //exclude: ["dist/1.chunk.js"]
    }),

    /**
     * 提取策略 : 
     * 
     */
    new webpack.optimize.CommonsChunkPlugin({
      names: ['common', 'manifest'],
      // async:true
    })
  ]
}