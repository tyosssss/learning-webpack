const { resolve, join } = require('path')
const webpack = require('../webpack-2.6.1/lib/webpack')
// const CleanWebpackPlugin = require('clean-webpack-plugin')
const SRC_PATH = resolve('src')
const OUTPUT_PATH = resolve('build')

// rawRequest 是否只包含资源文件
// loader 是否在rawReuqest
// async 异步模块


class NamedModuleIdsPlugin {
  constructor(options) {
    this.options = options || {}
  }

  apply(compiler) {
    let { nameMap } = this.options

    compiler.plugin("compilation", (compilation) => {
      compilation.plugin("before-module-ids", (modules) => {
        modules.forEach((module) => {
          if (module.id === null && nameMap[module.rawRequest]) {
            module.id = nameMap[module.rawRequest]
          }
        })
      })
    })
  }
}

module.exports = {
  context: SRC_PATH,

  entry: {
    main: './main.js'
  },

  output: {
    filename: '[name].js',
    path: OUTPUT_PATH
  },

  module: {

  },

  resolve: {
    alias: {
      'VendorJquery': resolve('./src/jquery')

    }
  },

  plugins: [
    // new webpack.HashedModuleIdsPlugin()
    // new webpack.NamedModulesPlugin(),
    new NamedModuleIdsPlugin({
      nameMap: {
        'VendorJquery': 'VendorJquery'
      }
    })
    // new CleanWebpackPlugin(['build'], {
    //   root: process.cwd(),
    //   verbose: true,
    //   dry: false,
    // })
  ]
}