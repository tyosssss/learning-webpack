'use strict'

let path = require('path')
let webpack = require("webpack")

module.exports = {
  context: path.resolve('examples','loader'),
 
  entry: './index.js',

  output:{
    filename:'[name].js',
    chunkFilename: "[name].js",
    path:path.resolve('dist')
  },

  module: {

    // loaders: [
    //   // 必须要有 .babelrc
    //   {
    //     test: /[\.js|\.jsx]$/,
    //     loaders:  [ './first-loader' ],
    //     exclude: /node_modules/
    //   }
    // ]

  }
};
