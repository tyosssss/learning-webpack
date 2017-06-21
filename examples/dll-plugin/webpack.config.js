const path = require('path')
const webpack = require('../../webpack-2.6.1/lib/webpack')
const fs = require('fs')
// const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = path.resolve(__dirname, 'src')
const DIST_PATH = path.resolve(__dirname, 'build')



module.exports = {
  context: path.resolve(SRC_PATH),

  entry: {
    'main': './main.js',
    // 'page1': './1.js'
  },

  output: {
    filename: '[name].js',
    chunkFilename: "[name].js",
    path: DIST_PATH
  },

  // resolve: {
  //   alias: {
  //     'Crocodile': './crocodile/vendor.js'
  //   }
  // },

  module: {
    rules: [
      {
        loader:'css-loader'
      }
    ]
  },

  plugins: [
    // new CleanWebpackPlugin(['build'], {
    //   root: path.resolve(__dirname),
    //   verbose: true,
    //   dry: false,
    //   //exclude: ["dist/1.chunk.js"]
    // }),

    new webpack.DllReferencePlugin({
      context: __dirname,

      scope: "ccc",

      name: 'crocodile_library',
      // sourceType: 'commonjs2',

      /**
       * 在这里引入 manifest 文件
       */
      manifest: require(path.resolve(path.join(__dirname, './dll/crocodile.manifest.json')))
    }),

    /**
     * 提取策略 : 
     * 
     * 将所有公共模块 --> common
     * 将jquery模块  --> jquery ( 之前的公共模块都被提取到common , 所以执行Jquery功模块提取时 , 不会存在其他公共模块 )
     * 生成的引导代码被放在seed中
     */
    // new webpack.optimize.CommonsChunkPlugin({
    //   // names: ['common', 'jquery', 'seed'],
    //   names: ['common', 'seed'],
    //   minChunks: 2
    // })
  ]
}