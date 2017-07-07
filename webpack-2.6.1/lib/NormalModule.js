/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const path = require("path");
const NativeModule = require("module");
const crypto = require("crypto");

const SourceMapSource = require("webpack-sources").SourceMapSource;
const OriginalSource = require("webpack-sources").OriginalSource;
const RawSource = require("webpack-sources").RawSource;
const ReplaceSource = require("webpack-sources").ReplaceSource;
const CachedSource = require("webpack-sources").CachedSource;
const LineToLineMappedSource = require("webpack-sources").LineToLineMappedSource;

const WebpackError = require("./WebpackError");
const Module = require("./Module");
const ModuleParseError = require("./ModuleParseError");
const ModuleBuildError = require("./ModuleBuildError");
const ModuleError = require("./ModuleError");
const ModuleWarning = require("./ModuleWarning");

const runLoaders = require("loader-runner").runLoaders;
const getContext = require("loader-runner").getContext;

/**
 * 将Buffer转换为字符串
 * 
 * @param {Buffer} buf 
 * @returns {String}
 */
function asString(buf) {
  if (Buffer.isBuffer(buf)) {
    return buf.toString("utf-8");
  }
  return buf;
}

function contextify(context, request) {
  return request
    .split("!")
    .map(function (r) {
      let rp = path.relative(context, r);

      if (path.sep === "\\")
        rp = rp.replace(/\\/g, "/");

      if (rp.indexOf("../") !== 0)
        rp = "./" + rp;

      return rp;
    }).join("!");
}

class NonErrorEmittedError extends WebpackError {
  constructor(error) {
    super();

    this.name = "NonErrorEmittedError";
    this.message = "(Emitted value instead of an instance of Error) " + error;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 普通模块
 * 
 * @class NormalModule
 * @extends {Module}
 */
class NormalModule extends Module {
  /**
   * 
   * @param {String} request 请求的完整绝对路径 , 加载器按执行顺序 ( 所有加载器请求 + 资源请求 )
   * @param {String} userRequest 用户请求的绝对路径 ( 行内加载器 + 资源请求 )
   * @param {String} rawRequest 原始的请求路径
   * @param {{{ident : String , loader : String , options : String|Object }[]}} loaders 所有的加载器配置
   * @param {String} resource 模块对应的资源文件的绝对路径 ( 包括查询字符串 )
   * @param {Parser} parser 代码解析器实例
   * @memberof NormalModule
   */
  constructor(request, userRequest, rawRequest, loaders, resource, parser) {
    super();
    this.request = request;
    this.userRequest = userRequest;
    this.rawRequest = rawRequest;
    this.parser = parser;
    this.resource = resource;
    this.context = getContext(resource);
    this.loaders = loaders;
    this.fileDependencies = [];
    this.contextDependencies = [];
    this.warnings = [];
    this.errors = [];
    this.error = null;
    this._source = null;
    this.assets = {};
    this.built = false;
    this._cachedSource = null;
  }

  /**
   * 获得模块的标识符
   * 
   * @returns {String}
   * @memberof NormalModule
   */
  identifier() {
    return this.request;
  }

  /**
   * 
   * 
   * @param {any} requestShortener 
   * @returns 
   * @memberof NormalModule
   */
  readableIdentifier(requestShortener) {
    return requestShortener.shorten(this.userRequest);
  }

	/**
	 * @param {Object} options
	 * @param {String} options.context
	 * @param {String} 
	 */
  libIdent(options) {
    return contextify(options.context, this.userRequest);
  }

  /**
   * 获得模块名 ( 返回不包含查询字符串的资源路径 )
   * 
   * @returns {String}
   * @memberof NormalModule
   */
  nameForCondition() {
    const idx = this.resource.indexOf("?");

    if (idx >= 0) return this.resource.substr(0, idx);
    return this.resource;
  }

  /**
   * 
   * 
   * @param {any} name 
   * @param {any} content 
   * @param {any} sourceMap 
   * @returns 
   * @memberof NormalModule
   */
  createSourceForAsset(name, content, sourceMap) {
    if (!sourceMap) {
      return new RawSource(content);
    }

    if (typeof sourceMap === "string") {
      return new OriginalSource(content, sourceMap);
    }

    return new SourceMapSource(content, name, sourceMap);
  }

  disconnect() {
    this.built = false;
    super.disconnect();
  }



	/** 
	 * 构建模块
	 * @param {Object} options 配置
	 * @param {Compilation} compilation 编译对象
	 * @param {Resolver} resolver 路径解析器
	 * @param {FileSystem} fs 文件系统
	 * @param {Function} callback 回调函数
	 */
  build(options, compilation, resolver, fs, callback) {
    this.buildTimestamp = Date.now();
    this.built = true;
    this._source = null;
    this.error = null;
    this.errors.length = 0;
    this.warnings.length = 0;
    this.meta = {};

    return this.doBuild(options, compilation, resolver, fs, (err) => {
      this.dependencies.length = 0;
      this.variables.length = 0;
      this.blocks.length = 0;
      this._cachedSource = null;

      // if we have an error mark module as failed and exit
      if (err) {
        this.markModuleAsErrored(err);

        return callback();
      }

      // check if this module should !not! be parsed.
      // if so, exit here;
      const noParseRule = options.module && options.module.noParse;

      //
      // 过滤 noParse
      //
      if (this.shouldPreventParsing(noParseRule, this.request)) {
        return callback();
      }

      try {
        //
        // 解析代码
        //
        this.parser.parse(this._source.source(), {
          current: this,
          module: this,
          compilation: compilation,
          options: options
        });
      } catch (e) {
        const source = this._source.source();
        const error = new ModuleParseError(this, source, e);
        this.markModuleAsErrored(error);
        return callback();
      }

      return callback();
    });
  }

  /**
	 * 执行构建操作
	 * @param {Object} options webpack 配置项
	 * @param {Compilation} compilation 编译对象
	 * @param {Resolver} resolver 路径解析器
	 * @param {FileSystem} fs 文件系统
	 * @param {Function} callback 回调函数
	 */
  doBuild(options, compilation, resolver, fs, callback) {
    this.cacheable = false;

    const loaderContext = this.createLoaderContext(resolver, options, compilation, fs);

    //
    // 运行加载器
    //
    runLoaders(
      {
        resource: this.resource,                // 资源路径
        loaders: this.loaders,                  // 加载器的配置
        context: loaderContext,                 // 加载器的执行上下文
        readResource: fs.readFile.bind(fs)      // 读取文件的方法
      },
      /**
       * done
       * @param {Error} err 错误
       * @param {Object} result 加载器的处理结果
       * @param {Buffer} result.resourceBuffer 资源二进制
       * @param {String} result.result[0] 原始内容
       * @param {String} result.result[1] 原始内容的映射
       */
      (err, result) => {

        if (result) {
          this.cacheable = result.cacheable;
          this.fileDependencies = result.fileDependencies;
          this.contextDependencies = result.contextDependencies;
        }

        if (err) {
          const error = new ModuleBuildError(this, err);
          return callback(error);
        }

        const resourceBuffer = result.resourceBuffer;
        const source = result.result[0];
        const sourceMap = result.result[1];

        if (!Buffer.isBuffer(source) && typeof source !== "string") {
          const error = new ModuleBuildError(this, new Error("Final loader didn't return a Buffer or String"));
          return callback(error);
        }

        // 创建源
        this._source = this.createSource(
          asString(source),
          resourceBuffer,
          sourceMap
        );

        return callback();
      });
  }

  /**
   * 创建加载器的执行上下文
   * 
	 * @param {Resolver} resolver 路径解析器
   * @param {Object} options webpack 配置项
	 * @param {Compilation} compilation 编译对象
	 * @param {FileSystem} fs 文件系统
   * @returns {Object}
   * @memberof NormalModule
   */
  createLoaderContext(resolver, options, compilation, fs) {
    const loaderContext = {
      version: 2,

      emitWarning: (warning) => {
        if (!(warning instanceof Error))
          warning = new NonErrorEmittedError(warning);
        this.warnings.push(new ModuleWarning(this, warning));
      },

      emitError: (error) => {
        if (!(error instanceof Error))
          error = new NonErrorEmittedError(error);
        this.errors.push(new ModuleError(this, error));
      },

      exec: (code, filename) => {
        const module = new NativeModule(filename, this);

        module.paths = NativeModule._nodeModulePaths(this.context);
        module.filename = filename;
        module._compile(code, filename);

        return module.exports;
      },

      resolve(context, request, callback) {
        resolver.resolve({}, context, request, callback);
      },

      resolveSync(context, request) {
        return resolver.resolveSync({}, context, request);
      },

      emitFile: (name, content, sourceMap) => {
        this.assets[name] = this.createSourceForAsset(name, content, sourceMap);
      },

      options: options,
      webpack: true,
      sourceMap: !!this.useSourceMap,
      _module: this,
      _compilation: compilation,
      _compiler: compilation.compiler,
      fs: fs,
    };

    compilation.applyPlugins("normal-module-loader", loaderContext, this);

    if (options.loader)
      Object.assign(loaderContext, options.loader);

    return loaderContext;
  }

  /**
   * 创建数据源实例
   * 
   * @param {String} source 原始数据
   * @param {Buffer} resourceBuffer 资源的字节流
   * @param {String} sourceMap 原始数据的Map
   * @returns {Source}
   * @memberof NormalModule
   */
  createSource(source, resourceBuffer, sourceMap) {
    // if there is no identifier return raw source
    if (!this.identifier) {
      return new RawSource(source);
    }

    // from here on we assume we have an identifier
    const identifier = this.identifier();

    if (this.lineToLine && resourceBuffer) {
      return new LineToLineMappedSource(
        source, identifier, asString(resourceBuffer));
    }

    if (this.useSourceMap && sourceMap) {
      return new SourceMapSource(source, identifier, sourceMap);
    }

    return new OriginalSource(source, identifier);
  }

  /**
   * 标记模块错误
   * 
   * @param {Error} error 
   * @memberof NormalModule
   */
  markModuleAsErrored(error) {
    this.meta = null;
    this.error = error;
    this.errors.push(this.error);
    this._source = new RawSource("throw new Error(" + JSON.stringify(this.error.message) + ");");
  }

  /**
   * check if module should not be parsed
   * returns "true" if the module should !not! be parsed
   * returns "false" if the module !must! be parsed
   * @param {String|RegExp|RegExp[]} noParseRule 
   * @param {String} request 
   * @returns {Boolean} true , 拒绝解析
   * @memberof NormalModule
   */
  shouldPreventParsing(noParseRule, request) {
    // if no noParseRule exists, return false
    // the module !must! be parsed.
    if (!noParseRule) {
      return false;
    }

    // we only have one rule to check
    if (!Array.isArray(noParseRule)) {
      // returns "true" if the module is !not! to be parsed
      return this.applyNoParseRule(noParseRule, request);
    }

    for (let i = 0; i < noParseRule.length; i++) {
      const rule = noParseRule[i];
      // early exit on first truthy match
      // this module is !not! to be parsed
      if (this.applyNoParseRule(rule, request)) {
        return true;
      }
    }
    // no match found, so this module !should! be parsed
    return false;
  }

  /**
   * 处理noParse的规则
   * 
   * @param {String|RegExp} rule 
   * @param {String} content 
   * @returns {Boolean}
   * @memberof NormalModule
   */
  applyNoParseRule(rule, content) {
    // must start with "rule" if rule is a string
    if (typeof rule === "string") {
      return content.indexOf(rule) === 0;
    }
    // we assume rule is a regexp
    return rule.test(content);
  }



  // ----------------------------------------------------------------
  // *************************  获得源  ************************
  // ----------------------------------------------------------------
  /**
   * 获得源 -- 表示模块最终的生成代码的数据源
   * 
   * @param {DependencyTemplates[]} dependencyTemplates 依赖模板实例
   * @param {Object} outputOptions 输出选项
   * @param {RequestShortener} requestShortener 请求路径简写器
   * @returns {CachedSource} 返回可缓存的源
   * @memberof NormalModule
   */
  source(dependencyTemplates, outputOptions, requestShortener) {
    // hash签名
    const hashDigest = this.getHashDigest();

    // 缓存有效 ( hash没有变化 , 即内容没有变化 ) 
    if (this._cachedSource && this._cachedSource.hash === hashDigest) {
      return this._cachedSource.source;
    }

    // 没有原始源 , 抛出异常
    if (!this._source) {
      return new RawSource("throw new Error('No source available');");
    }

    const source = new ReplaceSource(this._source);

    this._cachedSource = {
      source: source,
      hash: hashDigest
    };

    this.sourceBlock(this, [], dependencyTemplates, source, outputOptions, requestShortener);

    return new CachedSource(source);
  }

  /**
   * 
   * 
   * @param {DependeciesBlock} block 依赖块
   * @param {DependeciesBlockVariable[]} availableVars 有效的依赖块变量
   * @param {DependencyTemplates[]} dependencyTemplates 依赖模板实例 
   * @param {RawSource} source 源
   * @param {Object} outputOptions 输出选项
   * @param {RequestShortener} requestShortener 请求路径简写器
   * @memberof NormalModule
   */
  sourceBlock(block, availableVars, dependencyTemplates, source, outputOptions, requestShortener) {
    //
    // render dependencies
    //
    block.dependencies.forEach((dependency) =>
      this.sourceDependency(
        dependency,
        dependencyTemplates,
        source,
        outputOptions,
        requestShortener
      )
    );



    //
    // render dependenciesBlock
    // 获得需要注入的依赖块变量
    // name  -- 作为函数的形参
    // value -- 作为函数的实参
    //
    const vars = block.variables.map(
      (variable) => this.sourceVariables(
        variable,
        availableVars,
        dependencyTemplates,
        outputOptions,
        requestShortener
      ))
      .filter(Boolean);

		/**
		 * if we actually have variables
		 * this is important as how #splitVariablesInUniqueNamedChunks works
		 * it will always return an array in an array which would lead to a IIFE wrapper around
		 * a module if we do this with an empty vars array.
		 */
    if (vars.length > 0) {
			/**
			 * Split all variables up into chunks of unique names.
			 * e.g. imagine you have the following variable names that need to be injected:
			 * [foo, bar, baz, foo, some, more]
			 * we can not inject "foo" twice, therefore we just make two IIFEs like so:
			 * (function(foo, bar, baz){
			 *   (function(foo, some, more){
			 *     ...
			 *   }(...));
			 * }(...));
			 *
			 * "splitVariablesInUniqueNamedChunks" splits the variables shown above up to this:
			 * [[foo, bar, baz], [foo, some, more]]
			 */
      const injectionVariableChunks = this.splitVariablesInUniqueNamedChunks(vars);

      // create all the beginnings of IIFEs
      const functionWrapperStarts = injectionVariableChunks
        .map(variableChunk => variableChunk.map(variable => variable.name))
        .map(names => this.variableInjectionFunctionWrapperStartCode(names));

      // and all the ends
      const functionWrapperEnds = injectionVariableChunks
        .map(variableChunk => variableChunk.map(variable => variable.expression))
        .map(expressions => this.variableInjectionFunctionWrapperEndCode(expressions, block));

      // join them to one big string
      const varStartCode = functionWrapperStarts.join("");
      // reverse the ends first before joining them, as the last added must be the inner most
      const varEndCode = functionWrapperEnds.reverse().join("");

      // if we have anything, add it to the source
      if (varStartCode && varEndCode) {
        const start = block.range ? block.range[0] : -10;
        const end = block.range ? block.range[1] : (this._source.size() + 1);
        source.insert(start + 0.5, varStartCode);
        source.insert(end + 0.5, "\n/* WEBPACK VAR INJECTION */" + varEndCode);
      }
    }



    //
    // render 异步块
    //
    block.blocks.forEach((block) =>
      this.sourceBlock(
        block,
        availableVars.concat(vars),
        dependencyTemplates,
        source,
        outputOptions,
        requestShortener
      )
    );
  }

  /**
   * 生成依赖实例的最终代码 , 并将其插入到源source中
   * @param {Dependency} dependency 依赖实例
   * @param {DependencyTemplates[]} dependencyTemplates 依赖模板实例 
   * @param {RawSource} source 源
   * @param {Object} outputOptions 输出选项
   * @param {RequestShortener} requestShortener 请求路径简写器
   * @memberof NormalModule
   */
  sourceDependency(dependency, dependencyTemplates, source, outputOptions, requestShortener) {
    const template = dependencyTemplates.get(dependency.constructor);

    if (!template) {
      throw new Error("No template for dependency: " + dependency.constructor.name);
    }

    // 通过依赖模块 , 生成依赖实例的最终代码
    template.apply(dependency, source, outputOptions, requestShortener, dependencyTemplates);
  }

  /**
   * 生成依赖块变量的最终代码 , 并将其插入到源source中
   * 
   * @param {DependenciesBlockVariable} variable 
   * @param {DependeciesBlockVariable[]} availableVars 有效的依赖块变量
   * @param {DependencyTemplates[]} dependencyTemplates 依赖模板实例 
   * @param {RawSource} source 源
   * @param {Object} outputOptions 输出选项
   * @param {RequestShortener} requestShortener 请求路径简写器
   * @returns {Object} 返回变量 {name,expression}
   * @memberof NormalModule
   */
  sourceVariables(variable, availableVars, dependencyTemplates, outputOptions, requestShortener) {
    const name = variable.name;
    const expr = variable.expressionSource(dependencyTemplates, outputOptions, requestShortener);

    if (availableVars.some(v =>
      v.name === name &&
      v.expression.source() === expr.source())
    ) {
      return;
    }

    return {
      name: name,
      expression: expr
    };
  }

  /**
   * 
   * @param {Object[]} vars 
   */
  splitVariablesInUniqueNamedChunks(vars) {
    const startState = [
      []
    ];

    return vars.reduce((chunks, variable) => {
      const current = chunks[chunks.length - 1];
      
      // check if variable with same name exists already
      // if so create a new chunk of variables.
      const variableNameAlreadyExists = current.some(v => v.name === variable.name);

      if (variableNameAlreadyExists) {
        // start new chunk with current variable
        chunks.push([variable]);
      } else {
        // else add it to current chunk
        current.push(variable);
      }

      return chunks;
    }, startState);
  }

	/*
	 * creates the start part of a IIFE around the module to inject a variable name
	 * (function(...){   <- this part
	 * }.call(...))
	 */
  variableInjectionFunctionWrapperStartCode(varNames) {
    const args = varNames.join(", ");
    return `/* WEBPACK VAR INJECTION */(function(${args}) {`;
  }

	/*
	 * creates the end part of a IIFE around the module to inject a variable name
	 * (function(...){
	 * }.call(...))   <- this part
	 */
  variableInjectionFunctionWrapperEndCode(varExpressions, block) {
    const firstParam = this.contextArgument(block);
    const furtherParams = varExpressions.map(e => e.source()).join(", ");
    return `}.call(${firstParam}, ${furtherParams}))`;
  }

  /**
   * 
   * 
   * @param {any} block 
   * @returns 
   * @memberof NormalModule
   */
  contextArgument(block) {
    if (this === block) {
      return this.exportsArgument || "exports";
    }
    
    return "this";
  }



  /**
   * 获得原始的源 ( 没有render之前的 )
   * @returns {Source}
   */
  originalSource() {
    return this._source;
  }

  /**
   * 检查模块是否需要重新构建
   * 
   * @param {Map} fileTimestamps 
   * @param {Map} contextTimestamps 
   * @returns 
   * @memberof NormalModule
   */
  needRebuild(fileTimestamps, contextTimestamps) {
    const highestFileDepTimestamp = this.getHighestTimestamp(this.fileDependencies, fileTimestamps);

    // if the hightest is Infinity, we need a rebuild
    // exit early here.
    if (highestFileDepTimestamp === Infinity) {
      return true;
    }

    const highestContextDepTimestamp = this.getHighestTimestamp(
      this.contextDependencies, contextTimestamps);

    // Again if the hightest is Infinity, we need a rebuild
    // exit early here.
    if (highestContextDepTimestamp === Infinity) {
      return true;
    }

    // else take the highest of file and context timestamps and compare
    // to last build timestamp
    return Math.max(highestContextDepTimestamp, highestFileDepTimestamp) >= this.buildTimestamp;
  }

  /**
   * 
   * 
   * @param {any} keys 
   * @param {any} timestampsByKey 
   * @returns 
   * @memberof NormalModule
   */
  getHighestTimestamp(keys, timestampsByKey) {
    let highestTimestamp = 0;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const timestamp = timestampsByKey[key];
      // if there is no timestamp yet, early return with Infinity
      if (!timestamp) return Infinity;
      highestTimestamp = Math.max(highestTimestamp, timestamp);
    }

    return highestTimestamp;
  }

  /**
   * 
   * 
   * @returns 
   * @memberof NormalModule
   */
  size() {
    return this._source ? this._source.size() : -1;
  }

  /**
   * 获得hash签名 ( 内容签名 )
   * 
   * @returns {String}
   * @memberof NormalModule
   */
  getHashDigest() {
    const hash = crypto.createHash("md5");
    this.updateHash(hash);

    return hash.digest("hex");
  }

  /**
   * 
   * @param {*} hash 
   */
  updateHash(hash) {
    this.updateHashWithSource(hash);
    this.updateHashWithMeta(hash);
    super.updateHash(hash);
  }

  /**
   * 
   * 
   * @param {any} hash 
   * @returns 
   * @memberof NormalModule
   */
  updateHashWithSource(hash) {
    if (!this._source) {
      hash.update("null");
      return;
    }
    hash.update("source");
    this._source.updateHash(hash);
  }

  /**
   * 
   * @param {*} hash 
   */
  updateHashWithMeta(hash) {
    hash.update("meta");
    hash.update(JSON.stringify(this.meta));
  }
}

module.exports = NormalModule;
