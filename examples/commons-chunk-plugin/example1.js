const path = require('path')
const webpack = require("webpack")
const fs = require('fs')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const ChunkManifestPlugin = require('chunk-manifest-webpack-plugin')
const WebpackChunkHash = require('webpack-chunk-hash')
const SRC_PATH = path.resolve('src')
const DIST_PATH = path.resolve('build')

function CreateFileManifestPlugin(){
  
}

CreateFileManifestPlugin.prototype.apply = function(compiler){
    compiler.plugin("done",function(stats){
      console.log(stats.toJson())
    })
}


module.exports = {
  context: path.resolve(SRC_PATH),

  entry: {
    a: './a.js',
    // b: './b.js',
    jquery: ['./jquery']
  },

  output: {
    filename: '[name].[chunkhash].js',
    chunkFilename: "[name].[chunkhash].js",
    path: DIST_PATH
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json']
  },

  plugins: [
    new CleanWebpackPlugin(['build'], {
      root: process.cwd(),
      verbose: true,
      dry: false,
      //exclude: ["dist/1.chunk.js"]
    }),

    /**
     * 提取策略 : 
     * 
     * 将所有公共模块 --> common
     * 将jquery模块  --> jquery ( 之前的公共模块都被提取到common , 所以执行Jquery功模块提取时 , 不会存在其他公共模块 )
     * 生成的引导代码被放在seed中
     */
    new webpack.optimize.CommonsChunkPlugin({
      names: ['common', 'jquery', 'seed'],
      minChunks: 2
    }),

    // new webpack.optimize.UglifyJsPlugin({
    //   compress: {
    //     //supresses warnings, usually from module minification
    //     warnings: true,
    //     // drop_console: (options.env == 'uat' || options.env == "prod")
    //   },
    //   // mangle: {
    //   //   except: mangleExcept
    //   // }
    // }),

    new WebpackChunkHash(),

    new ChunkManifestPlugin({
      filename:'manifest.json',
      manifestVariable:'webpackManifest',
      inlineManifest:false
    })
  ]
}