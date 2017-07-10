const path = require('path')
const webpack = require("../../../webpack-2.6.1")
const fs = require('fs')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = path.resolve('src')
const DIST_PATH = path.resolve('build')



module.exports = {
  context: path.resolve(SRC_PATH),

  entry: {
    // a: './a.js',
    // b: './b.js',
    // jquery: ['./jquery']
    main: './main.js'
  },

  output: {
    filename: '[name].js',
    chunkFilename: "[name].js",
    path: DIST_PATH
  },

  plugins: [
    // new CleanWebpackPlugin(['build'], {
    //   root: path.resolve(__dirname),
    //   verbose: true,
    //   dry: false,
    //   //exclude: ["dist/1.chunk.js"]
    // }),

    /**
     * 提取策略 : 
     */
    new webpack.optimize.CommonsChunkPlugin({
      // names: ['common', 'jquery' , 'seed'],
      name: 'common',
      fileName: 'common.js',
      chunks: ['main'],
      // children: true,
      async:true,
      minChunks: 1
    })
  ]
}