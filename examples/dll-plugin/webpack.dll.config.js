const path = require('path')
const webpack = require("webpack")
const fs = require('fs')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = path.resolve(__dirname, 'src')
const DIST_PATH = path.resolve(__dirname, 'dll')



module.exports = [
  {
    context: path.resolve(SRC_PATH),

    // entry: {
    //   'model': './crocodile/model',
    //   'storage': './crocodile/storage',
    //   'vendor': './crocodile/vendor',
    //   'crocodile': './crocodile/crocodile'
    // },
    entry: [
      // './crocodile/model',
      './crocodile/storage',
      './crocodile/vendor',
      './crocodile/crocodile'
    ],

    output: {
      path: path.resolve(DIST_PATH, 'main'),
      filename: '[name].dll.js',
      chunkFilename: "[name].js",
      library: 'aa',
    },

    plugins: [
      new CleanWebpackPlugin(['dll'], {
        root: path.resolve(__dirname),
        verbose: true,
        dry: false,
        //exclude: ["dist/1.chunk.js"]
      }),

      new webpack.DllPlugin({
        /**
         * path
         * 定义 manifest 文件生成的位置
         * [name]的部分由entry的名字替换
         */
        path: path.join(DIST_PATH, 'main', 'manifest.json'),

        /**
         * name
         * dll bundle 输出到那个全局变量上
         * 和 output.library 一样即可。 
         */
        name: '[name]'
      })
      
      /**
       * 提取策略 : 
       * 
       * 将所有公共模块 --> common
       * 将jquery模块  --> jquery ( 之前的公共模块都被提取到common , 所以执行Jquery功模块提取时 , 不会存在其他公共模块 )
       * 生成的引导代码被放在seed中
       */
      // new webpack.optimize.CommonsChunkPlugin({
      //   names: ['common', 'jquery', 'seed'],
      //   minChunks: 2
      // })
    ]
  },
  {
    context: path.resolve(SRC_PATH),

    // entry: {
    //   'model': './crocodile/model',
    //   'storage': './crocodile/storage',
    //   'vendor': './crocodile/vendor',
    //   'crocodile': './crocodile/crocodile'
    // },
    entry: [
      './crocodile/model',
    ],

    output: {
      path: path.resolve(DIST_PATH, 'model'),
      filename: '[name].dll.js',
      chunkFilename: "[name].js",
      library: '[name]_library',
    },


    plugins: [
      new CleanWebpackPlugin(['dll'], {
        root: path.resolve(__dirname),
        verbose: true,
        dry: false,
        //exclude: ["dist/1.chunk.js"]
      }),

      new webpack.DllPlugin({
        /**
         * path
         * 定义 manifest 文件生成的位置
         * [name]的部分由entry的名字替换
         */
        path: path.join(DIST_PATH, 'model', 'manifest.json'),

        /**
         * name
         * dll bundle 输出到那个全局变量上
         * 和 output.library 一样即可。 
         */
        name: '[name]'
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
      })
    ]
  }
]