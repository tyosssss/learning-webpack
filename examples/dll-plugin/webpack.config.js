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

  // module: {
  //   rules: [
  //     {
  //       enforce: 'pre',
  //       loader: '../../test-loader',
  //       options: {
  //         type: '---pre---',
  //       }
  //     },
  //     {
  //       loader: '../../test-loader',
  //       options: {
  //         type: '---normal---',
  //       }
  //     },
  //     {
  //       enforce: 'post',
  //       loader: '../../test-loader',
  //       options: {
  //         type: '---post---',
  //       }
  //     }
  //   ]
  // },

  plugins: [
    (function () {
      return {
        apply(compiler) {
          compiler.plugin('this-compilation', (compilation, params) => {
            let { mainTemplate } = compilation
            const ParserHelpers = require("webpack/lib/ParserHelpers");
            const ConstDependency = require("webpack/lib/dependencies/ConstDependency")
            const NullFactory = require("webpack/lib/NullFactory")
            // const NullDependency = require("webpack/lib/NullDependency");

            // class RequireHeaderDependency11 extends NullDependency {
            //   constructor(range) {
            //     super();
            //     if (!Array.isArray(range)) throw new Error("range must be valid");
            //     this.range = range;
            //   }
            // }

            // RequireHeaderDependency11.Template = class RequireHeaderDependency11 {
            //   /**
            //    * 
            //    * @param {Dependency} dep 
            //    * @param {ReplaceSource} source 
            //    */
            //   apply(dep, source) {
            //     source.replace(dep.range[0], dep.range[1] - 1, "__webpack_require__");
            //   }

            //   applyAsTemplateArgument(name, dep, source) {
            //     source.replace(dep.range[0], dep.range[1] - 1, "require");
            //   }
            // };

            compilation.dependencyFactories.set(ConstDependency, new NullFactory());
            compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());

            params.normalModuleFactory.plugin("parser", parser => {
              parser.plugin("evaluate Identifier __abcdefg___", function (expr) {
                if (!this.state.module) return;
                return ParserHelpers.evaluateToString('哈哈哈')(expr);
              });


              parser.plugin("expression __abcdefg___", function (expr) {
                if (!this.state.module) return;

                const dep = new ConstDependency(`哈哈哈`, expr.range);
                dep.loc = expr.loc;
                this.state.current.addDependency(dep);

                // dep.loc = expr.loc;
                // parser.state.current.addDependency(dep);

                // 添加变量依赖
                // this.state.current.ad(
                //   "__abcdefg___",
                //   "哈哈哈"
                // );

                return true;
              });
            })

          })
        }
      }
    })()
    // new CleanWebpackPlugin(['build'], {
    //   root: path.resolve(__dirname),
    //   verbose: true,
    //   dry: false,
    //   //exclude: ["dist/1.chunk.js"]
    // }),

    // new webpack.DllReferencePlugin({
    //   context: __dirname,

    //   scope: "ccc",

    //   name: 'crocodile_library',
    //   // sourceType: 'commonjs2',

    //   /**
    //    * 在这里引入 manifest 文件
    //    */
    //   manifest: require(path.resolve(path.join(__dirname, './dll/crocodile.manifest.json')))
    // }),

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