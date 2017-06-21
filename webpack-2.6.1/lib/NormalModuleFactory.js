/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
"use strict";

const asyncLib = require("async");
const Tapable = require("tapable");
const NormalModule = require("./NormalModule");
const RawModule = require("./RawModule");
const Parser = require("./Parser");
const RuleSet = require("./RuleSet");


/**
 * 模块数据
 * @typedef {Object} ModuleInfo
 * @property {issuer:String,compiler:String} contextInfo 上下文信息
 * @property {String} context 上下文路径
 * @property {Dependency[]} dependencies 模块的依赖,即该模块依赖的模块 ( 包括自身 )
 */

/**
 * 加载器参数
 * @typedef {Object} LoaderParams
 * @property {String} loader 加载器的请求路径
 * @property {Object} options 加载器的选项
 * @property {Dependency[]} dependencies 模块的依赖,即该模块依赖的模块 ( 包括自身 )
 */

/**
 * @typedef {Object} ResolveParams
 * @property {issuer:String,compiler:String} contextInfo 上下文信息
 * @property {String} context 上下文路径
 * @property {String} request 模块的请求路径
 * @property {Dependency[]} dependencies 模块的依赖,即该模块依赖的模块 ( 包括自身 )
 */



/**
 * ResourceResolveData
 * 
 * context
 *   compiler:undefined
 * 	 issuer:"/Users/tyo/Documents/Codes/github/77681649@qq.com/learning-webpack/src/main.js"
 * 
 * descriptionFileData
 * descriptionFilePath:"/Users/tyo/Documents/Codes/github/77681649@qq.com/learning-webpack/package.json"
 * descriptionFileRoot:"/Users/tyo/Documents/Codes/github/77681649@qq.com/learning-webpack"
 * 
 * resolvePath : "./src/utils/1.js"
 * path : "/Users/tyo/Documents/Codes/github/77681649@qq.com/learning-webpack/src/utils/1.js"
 * query:""
 */

/**
 * 
 * @class NormalModuleFactory
 * @extends {Tapable}
 */
class NormalModuleFactory extends Tapable {
  constructor(context, resolvers, options) {
    super();

		/**
		 * 路径解析器
		 * @type {normal:Resolver , loader:Resolver , context:Resolver}
		 */
    this.resolvers = resolvers;

		/**
		 * 规则集合
		 * @type {RuleSet}
		 */
    this.ruleSet = new RuleSet(options.rules || options.loaders);

		/**
		 * 缓存判断函数
		 * @type {Function}
		 */
    this.cachePredicate = typeof options.unsafeCache === "function"
      ? options.unsafeCache
      : Boolean.bind(null, options.unsafeCache);

		/**
		 * 上下文的路径
		 * @type {String}
		 */
    this.context = context || "";

		/**
		 * 
		 * @type Map<>
		 */
    this.parserCache = {};

    // 
    // 创建模块工厂
    //
    this.plugin("factory", function () {
			/**
			 * factory
			 * @param {ResolveParams} params 参数
			 * @param {Function} calback 回调函数
			 */
      return (result, callback) => {
        /* beautify preserve:end */

        // 创建resolver
        let resolver = this.applyPluginsWaterfall0("resolver", null);

        // Ignored
        if (!resolver) return callback();

				/**
				 * @param {ResolveParams} data 解析器参数
			 	 * @param {Function} callback 回调函数
				 */
        resolver(result, (err, data) => {
          if (err) return callback(err);

          // Ignored
          if (!data) return callback();

          // direct module
          if (typeof data.source === "function") return callback(null, data);

          this.applyPluginsAsyncWaterfall("after-resolve", data, (err, result) => {
            if (err) return callback(err);

            // Ignored
            if (!result)
              return callback();

            let createdModule = this.applyPluginsBailResult("create-module", result);

            if (!createdModule) {

              if (!result.request) {
                return callback(new Error("Empty dependency (no request)"));
              }

              createdModule = new NormalModule(
                result.request,
                result.userRequest,
                result.rawRequest,
                result.loaders,
                result.resource,
                result.parser
              );
            }

            createdModule = this.applyPluginsWaterfall0("module", createdModule);

            return callback(null, createdModule);
          });
        });
      };
    });

    //
    // 创建解析器
    //
    this.plugin("resolver", function () {
      /* beautify preserve:start */
      // js-beautify consider to concat "return" and "("
      // but it сontradicts eslint rule (keyword-spacing)

			/**
			 * resolver
			 * @param {ResolveParams} 解析器参数
			 * @param {Function} callback 回调函数
			 */
      return (data, callback) => {
        /* beautify preserve:end */
        const contextInfo = data.contextInfo;
        const context = data.context;
        const request = data.request;

        const noPrePostAutoLoaders = /^!!/.test(request);	// 匹配 ^!!       true = 
        const noAutoLoaders = /^-?!/.test(request);				// 匹配 ^-! , ^!  true =
        const noPostAutoLoaders = /^-!/.test(request);		// 匹配 ^-!       true = 

				/**
				 * 路径元素
				 * 
				 * [{loader,options} , {loader , options} , ... , resource ]
				 * 
				 * @type {String[]}
				 */
        let elements = request
          .replace(/^-?!+/, "")
          .replace(/!!+/g, "!")
          .split("!");

        // 资源路径
        let resource = elements.pop();

        // 加载器
        elements = elements.map(identToLoaderRequest);

        asyncLib.parallel([
          //
          // 解析加载器的路径
          //
          callback => {
            this.resolveRequestArray(
              contextInfo,
              context,
              elements,
              this.resolvers.loader,
              callback
            )
          },

          //
          // 解析资源的路径
          // 
          callback => {
            // 没有请求资源的情况
            if (resource === "" || resource[0] === "?") {
              return callback(null, { resource });
            }


            this.resolvers.normal.resolve(
              contextInfo,
              context,
              resource,
              (err, resource, resourceResolveData) => {
                if (err) return callback(err);
                callback(null, {
                  resourceResolveData,
                  resource
                });
              }
            );
          }
        ], (err, results) => {
          if (err) return callback(err);
          let loaders = results[0];
          const resourceResolveData = results[1].resourceResolveData;
          
          resource = results[1].resource;

          // translate option idents
          try {
            loaders.forEach(item => {
              if (typeof item.options === "string" && /^\?/.test(item.options)) {
                item.options = this.ruleSet.findOptionsByIdent(item.options.substr(1));
              }
            });
          } catch (e) {
            return callback(e);
          }

          if (resource === false) {
            // ignored
            return callback(null,
              new RawModule(
                "/* (ignored) */",
                `ignored ${context} ${request}`,
                `${request} (ignored)`
              )
            );
          }

          const userRequest = loaders
            .map(loaderToIdent)
            .concat([resource])
            .join("!");

          let resourcePath = resource;
          let resourceQuery = "";
          const queryIndex = resourcePath.indexOf("?");

          if (queryIndex >= 0) {
            resourceQuery = resourcePath.substr(queryIndex);
            resourcePath = resourcePath.substr(0, queryIndex);
          }

          const result = this.ruleSet.exec({
            resource: resourcePath,
            resourceQuery,
            issuer: contextInfo.issuer,
            compiler: contextInfo.compiler
          });

          const settings = {};
          const useLoadersPost = [];
          const useLoaders = [];
          const useLoadersPre = [];

          result.forEach(r => {
            if (r.type === "use") {
              if (r.enforce === "post" && !noPostAutoLoaders
                && !noPrePostAutoLoaders)
                useLoadersPost.push(r.value);
              else if (r.enforce === "pre" && !noPrePostAutoLoaders)
                useLoadersPre.push(r.value);
              else if (!r.enforce && !noAutoLoaders && !noPrePostAutoLoaders)
                useLoaders.push(r.value);
            } else {
              settings[r.type] = r.value;
            }
          });

          asyncLib.parallel([
            this.resolveRequestArray.bind(this, contextInfo, this.context, useLoadersPost, this.resolvers.loader),
            this.resolveRequestArray.bind(this, contextInfo, this.context, useLoaders, this.resolvers.loader),
            this.resolveRequestArray.bind(this, contextInfo, this.context, useLoadersPre, this.resolvers.loader)
          ], (err, results) => {
            if (err) return callback(err);
            loaders = results[0].concat(loaders, results[1], results[2]);

            // debugger
            process.nextTick(() => {
              callback(null, {
                context: context,
                request: loaders.map(loaderToIdent).concat([resource]).join("!"),
                dependencies: data.dependencies,
                userRequest,
                rawRequest: request,
                loaders,
                resource,
                resourceResolveData,
                parser: this.getParser(settings.parser)
              });
            });
          });
        });
      };
    });
  }

	/**
	 * 创建模块
	 * @param {ModuleInfo} data 模块信息
	 * @param {Function} callback 回调函数 (err:Error,module:Module)=>void
	 */
  create(data, callback) {
    const dependencies = data.dependencies;
    const cacheEntry = dependencies[0].__NormalModuleFactoryCache;

    // 如果已经缓存
    if (cacheEntry) {
      return callback(null, cacheEntry);
    }

    const context = data.context || this.context; // 请求上下文路径
    const request = dependencies[0].request;      // 请求路径
    const contextInfo = data.contextInfo || {};   // 请求上下文信息
    let resolverParams = {                        // 解析器参数
      contextInfo,
      context,
      request,
      dependencies
    };

    this.applyPluginsAsyncWaterfall(
      "before-resolve",
      resolverParams,
      (err, result) => {
        // before-resolve中发生错误 , 那么直接返回
        if (err) return callback(err);

        // result == null , 所有需要忽略该模块 , 那么直接返回null
        if (!result) return callback();

        // 创建module factory
        const factory = this.applyPluginsWaterfall0("factory", null);

        // Ignored
        if (!factory) return callback();

        // 创建模块
        factory(result, (err, module) => {
          if (err) return callback(err);

          // 如果模块需要缓存 , 那么就将其缓存在依赖对象中
          if (module && this.cachePredicate(module)) {
            dependencies.forEach(d => d.__NormalModuleFactoryCache = module);
          }

          callback(null, module);
        });
      });
  }

	/**
	 * 解析请求数组
	 * @param {Object} contextInfo 上下文信息
	 * @param {String} context 上下文路径
	 * @param {{loader , options}[]} array 请求数组
	 * @param {Resolver} resolver 请求解析器
	 * @param {Function} callback 回调函数 (err:Error , loaderRequest : String ) = >void
	 */
  resolveRequestArray(contextInfo, context, array, resolver, callback) {
    // 没有加载器
    if (array.length === 0) {
      return callback(null, []);
    }

    // 异步解析所有加载器的路径
    asyncLib.map(array, (item, callback) => {
      resolver.resolve(
        contextInfo,
        context,
        item.loader,
        function onResolved(err, result) {
          /**
           * 对自动补全"-loader"做错误提示处理
           * 
           * 如果 解析失败 && loader is not absolute path && 不包含 "-loader"
           * 那么 测试一下添加"-loader"是否能解析 -- 如果能解析 , 那么提示错误
           */
          if (err && /^[^/]*$/.test(item.loader) && !/-loader$/.test(item.loader)) {
            return resolver.resolve(
              contextInfo,
              context,
              item.loader + "-loader", err2 => {

                if (!err2) {
                  err.message = err.message + "\n" +
                    "BREAKING CHANGE: It's no longer allowed to omit the '-loader' suffix when using loaders.\n" +
                    `                 You need to specify '${item.loader}-loader' instead of '${item.loader}',\n` +
                    "                 see https://webpack.js.org/guides/migrating/#automatic-loader-module-name-extension-removed";
                }

                callback(err);
              });
          }

          // 
          // 其他错误
          //
          if (err) {
            return callback(err);
          }

          const optionsOnly =
            item.options
              ? { options: item.options }
              : undefined;

          return callback(
            null,
            Object.assign(
              {},
              item,
              identToLoaderRequest(result),
              optionsOnly
            )
          );
        });
    }, callback);
  }

	/**
	 * 
	 * @param {*} parserOptions 
	 */
  getParser(parserOptions) {
    let ident = "null";
    if (parserOptions) {
      if (parserOptions.ident)
        ident = parserOptions.ident;
      else
        ident = JSON.stringify(parserOptions);
    }
    const parser = this.parserCache[ident];
    if (parser)
      return parser;
    return this.parserCache[ident] = this.createParser(parserOptions);
  }

	/**
	 * @param {*} parserOptions 
	 */
  createParser(parserOptions) {
    const parser = new Parser();
    this.applyPlugins2("parser", parser, parserOptions || {});
    return parser;
  }
}

/**
 * 
 * @param {LoaderParams} data 
 */
function loaderToIdent(data) {
  if (!data.options)
    return data.loader;

  if (typeof data.options === "string")
    return data.loader + "?" + data.options;

  if (typeof data.options !== "object")
    throw new Error("loader options must be string or object");

  if (data.ident)
    return data.loader + "??" + data.ident;

  return data.loader + "?" + JSON.stringify(data.options);
}

/**
 * 识别加载器请求 , 返回加载器参数对象
 * @param {String} resultString 字符串
 * @returns {loader , options} 返回识别的加载器请求
 */
function identToLoaderRequest(resultString) {
  const idx = resultString.indexOf("?");
  let options;

  // has querystring
  if (idx >= 0) {
    options = resultString.substr(idx + 1);
    resultString = resultString.substr(0, idx);

    return {
      loader: resultString,
      options
    };
  } else {
    return {
      loader: resultString
    };
  }
}

module.exports = NormalModuleFactory;
