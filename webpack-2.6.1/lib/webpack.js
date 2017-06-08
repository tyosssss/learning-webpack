/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const Compiler = require("./Compiler");
const MultiCompiler = require("./MultiCompiler");
const NodeEnvironmentPlugin = require("./node/NodeEnvironmentPlugin");
const WebpackOptionsApply = require("./WebpackOptionsApply");
const WebpackOptionsDefaulter = require("./WebpackOptionsDefaulter");
const validateSchema = require("./validateSchema");
const WebpackOptionsValidationError = require("./WebpackOptionsValidationError");
const webpackOptionsSchema = require("../schemas/webpackOptionsSchema.json");

/**
 * Compiler 构造工厂
 * 
 * @param {Object} options 配置项
 * @param {Function} callback 当执行编译完成之后触发
 * @returns {Compiler} 返回实例
 */
function webpack(options, callback) {
  //
  // 验证webpack.config
  // 如果发生错误 , 则抛出异常
  //
  const webpackOptionsValidationErrors = validateSchema(webpackOptionsSchema, options);
  if (webpackOptionsValidationErrors.length) {
    throw new WebpackOptionsValidationError(webpackOptionsValidationErrors);
  }

  let compiler;
  if (Array.isArray(options)) {
    compiler = new MultiCompiler(options.map(options => webpack(options)));
  } else if (typeof options === "object") {

    // options = extend(defaultOptions , options)
    new WebpackOptionsDefaulter().process(options);

    /**
     * 创建一个 compiler
     */
    compiler = new Compiler();
    compiler.context = options.context;
    compiler.options = options;

    // 注册 NodeEnvironmentPlugin , 配置文件系统
    new NodeEnvironmentPlugin().apply(compiler);

    // 注册 插件
    if (options.plugins && Array.isArray(options.plugins)) {
      compiler.apply.apply(compiler, options.plugins);
    }

    // 触发 enviroment事件
    compiler.applyPlugins("environment");
    compiler.applyPlugins("after-environment");

    // 根据配置项,加载相关的插件
    compiler.options = new WebpackOptionsApply().process(options, compiler);
  } else {
    throw new Error("Invalid argument: options");
  }

  //
  // 若有回调函数 , 则根据配置项来决定是以普通方式还是以watch方式运行webpack
  //
  if (callback) {
    if (typeof callback !== "function") 
      throw new Error("Invalid argument: callback");

    if (options.watch === true || 
        (Array.isArray(options) && options.some(o => o.watch))) {
      const watchOptions = Array.isArray(options) 
        ? options.map(o => o.watchOptions || {}) 
        : (options.watchOptions || {});

      return compiler.watch(watchOptions, callback);
    }
    
    compiler.run(callback);
  }

  return compiler;
}
exports = module.exports = webpack;

webpack.WebpackOptionsDefaulter = WebpackOptionsDefaulter;
webpack.WebpackOptionsApply = WebpackOptionsApply;
webpack.Compiler = Compiler;
webpack.MultiCompiler = MultiCompiler;
webpack.NodeEnvironmentPlugin = NodeEnvironmentPlugin;
webpack.validate = validateSchema.bind(this, webpackOptionsSchema);
webpack.validateSchema = validateSchema;
webpack.WebpackOptionsValidationError = WebpackOptionsValidationError;

function exportPlugins(exports, path, plugins) {
  plugins.forEach(name => {
    Object.defineProperty(exports, name, {
      configurable: false,
      enumerable: true,
      get() {
        return require(`${path}/${name}`);
      }
    });
  });
}

exportPlugins(exports, ".", [
  "DefinePlugin",
  "NormalModuleReplacementPlugin",
  "ContextReplacementPlugin",
  "IgnorePlugin",
  "WatchIgnorePlugin",
  "BannerPlugin",
  "PrefetchPlugin",
  "AutomaticPrefetchPlugin",
  "ProvidePlugin",
  "HotModuleReplacementPlugin",
  "SourceMapDevToolPlugin",
  "EvalSourceMapDevToolPlugin",
  "EvalDevToolModulePlugin",
  "CachePlugin",
  "ExtendedAPIPlugin",
  "ExternalsPlugin",
  "JsonpTemplatePlugin",
  "LibraryTemplatePlugin",
  "LoaderTargetPlugin",
  "MemoryOutputFileSystem",
  "ProgressPlugin",
  "SetVarMainTemplatePlugin",
  "UmdMainTemplatePlugin",
  "NoErrorsPlugin",
  "NoEmitOnErrorsPlugin",
  "NewWatchingPlugin",
  "EnvironmentPlugin",
  "DllPlugin",
  "DllReferencePlugin",
  "LoaderOptionsPlugin",
  "NamedModulesPlugin",
  "NamedChunksPlugin",
  "HashedModuleIdsPlugin",
  "ModuleFilenameHelpers"
]);

exportPlugins(exports.optimize = {}, "./optimize", [
  "AggressiveMergingPlugin",
  "AggressiveSplittingPlugin",
  "CommonsChunkPlugin",
  "ChunkModuleIdRangePlugin",
  "DedupePlugin",
  "LimitChunkCountPlugin",
  "MinChunkSizePlugin",
  "OccurrenceOrderPlugin",
  "UglifyJsPlugin"
]);

exportPlugins(exports.dependencies = {}, "./dependencies", []);
