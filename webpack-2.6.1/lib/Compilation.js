/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
	*/
"use strict";

const asyncLib = require("async");
const crypto = require("crypto");
const Tapable = require("tapable");
const EntryModuleNotFoundError = require("./EntryModuleNotFoundError");
const ModuleNotFoundError = require("./ModuleNotFoundError");
const ModuleDependencyWarning = require("./ModuleDependencyWarning");
const ModuleDependencyError = require("./ModuleDependencyError");
const Module = require("./Module");
const Chunk = require("./Chunk");
const Entrypoint = require("./Entrypoint");
const MainTemplate = require("./MainTemplate");
const ChunkTemplate = require("./ChunkTemplate");
const HotUpdateChunkTemplate = require("./HotUpdateChunkTemplate");
const ModuleTemplate = require("./ModuleTemplate");
const Dependency = require("./Dependency");
const ChunkRenderError = require("./ChunkRenderError");
const CachedSource = require("webpack-sources").CachedSource;
const Stats = require("./Stats");

/**
 * @typedef {Slot}
 * @property {String} name 模块名称
 * @property {Module} module 模块
 */

/**
 * 
 * @param {Number|String} a id1
 * @param {Number|String} b id2
 */
function byId(a, b) {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * 遍历注入变量依赖列表中的依赖列表 , 将依赖作为参数值 , 调用指定函数fn
 * @param {DependenciesBlockVariable[]} variables 注入变量依赖
 * @param {Function} fn 
 */
function iterationBlockVariable(variables, fn) {
  for (let indexVariable = 0; indexVariable < variables.length; indexVariable++) {

    let varDep = variables[indexVariable].dependencies;

    for (let indexVDep = 0; indexVDep < varDep.length; indexVDep++) {
      fn(varDep[indexVDep]);
    }
  }
}

/**
 * 遍历数组执行指定函数
 * @param {DependenciesBlock[]} arr 
 * @param {Function} fn 
 */
function iterationOfArrayCallback(arr, fn) {
  for (let index = 0; index < arr.length; index++) {
    fn(arr[index]);
  }
}

/**
 * 表示一次编译的实例
 * 
 * @class Compilation
 * @extends {Tapable}
 */
class Compilation extends Tapable {
  constructor(compiler) {
    super();

    /**
     * 
     */
    this.compiler = compiler;

    /**
     * 解析器
     * @type {Object}
     */
    this.resolvers = compiler.resolvers;

    /**
     * 文件系统
     * @type {FileSystem}
     */
    this.inputFileSystem = compiler.inputFileSystem;

    /**
     * 初始化配置项
     */
    const options = this.options = compiler.options;
    this.outputOptions = options && options.output;
    this.bail = options && options.bail;
    this.profile = options && options.profile;
    this.performance = options && options.performance;

    /**
     * 创建模板的实例
     */
    this.mainTemplate = new MainTemplate(this.outputOptions);
    this.chunkTemplate = new ChunkTemplate(this.outputOptions);
    this.hotUpdateChunkTemplate = new HotUpdateChunkTemplate(this.outputOptions);
    this.moduleTemplate = new ModuleTemplate(this.outputOptions);

		/**
		 * 存储所有的入口模块
		 * @type {Module}
		 */
    this.entries = [];

		/**
		 * 存储所有的预先加载的块 --- 即入口块
		 * @type {Solt}
		 */
    this.preparedChunks = [];

    /**
     * 
     */
    this.entrypoints = {};

    /**
     * @type {Chunk[]}
     */
    this.chunks = [];

    /**
     * @type {Chunk[]}
     */
    this.namedChunks = {};

    /**
     * 存储编译中遇到的所有模块
     * @type {Module[]}
     */
    this.modules = [];

    /**
     * 存储编译中遇到的所有模块
     * @type {Map<identifier,Module>}
     */
    this._modules = {};

    /**
     * 缓存
     * @type {Object}
     */
    this.cache = null;

    /**
     * 
     */
    this.records = null;

    /**
     * 
     */
    this.nextFreeModuleIndex = undefined;

    /**
     * 
     */
    this.nextFreeModuleIndex2 = undefined;

    /**
     * 
     */
    this.additionalChunkAssets = [];

    /**
     * @type {Map<file : String , source : Source>}
     */
    this.assets = {};

		/**
		 * 存储发生的错误
		 * @type {Error}
		 */
    this.errors = [];

		/**
		 * 
		 */
    this.warnings = [];

    /**
     * 
     */
    this.children = [];

		/**
		 * 存储模块工厂与依赖的对应关系 ( 实现依赖注入 )
		 * @type {Map<Dependency,ModuleFactory>}
		 */
    this.dependencyFactories = new Map();

		/**
		 * 存储 模板与依赖的对应关系 ( 实现依赖注入 )
		 * @type {Map<Dependency,Template>}
		 */
    this.dependencyTemplates = new Map();
  }



  // ----------------------------------------------------------------
  // *******************  基于入口块 , 创建依赖图  ********************
  // ----------------------------------------------------------------
  /**
	 * 添加入口依赖
	 * @param {String} context 上下文路径 ( config.output )
	 * @param {ModuleDependency} entry 入口模块依赖
	 * @param {String} name 入口块的名称 ( ChunkName )
	 * @param {Function} onMaked 当make完成时触发
	 */
  addEntry(context, entry, name, onMaked) {
    const slot = {
      name: name,
      module: null
    };

    // add 预加载块
    this.preparedChunks.push(slot);

    // 以entry为起点 , 将引用到的所有模块
    this._addModuleChain(
      context,
      entry,
      (module) => {
        entry.module = module;
        this.entries.push(module);

        module.issuer = null;
      },
      (err, module) => {
        if (err) {
          return onMaked(err);
        }

        if (module) {
          slot.module = module;
        } else {
          // 从preparedChunks中移除
          const idx = this.preparedChunks.indexOf(slot);
          this.preparedChunks.splice(idx, 1);
        }

        return onMaked(null, module);
      });
  }

  /**
	 * 以依赖模块dependency为起点 , 生成依赖模块链
	 * @param {String} context 依赖的上下文路径
	 * @param {Dependency} dependency 依赖
	 * @param {Function} onModule 当模块创建成功之后 , 触发的回调函数
	 * @param {Function} callback 当模块链添加完毕之后触发
	 */
  _addModuleChain(context, dependency, onModule, callback) {
    const start = this.profile && Date.now();

    // 包装错误回调函数
    const errorAndCallback =
      this.bail
        ? function errorAndCallback(err) {
          callback(err);
        }
        : function errorAndCallback(err) {
          err.dependencies = [dependency];
          this.errors.push(err);
          callback();
        }.bind(this);

    // 依赖无效
    if (typeof dependency !== "object" ||
      dependency === null ||
      !dependency.constructor) {
      throw new Error("Parameter 'dependency' must be a Dependency");
    }

    // 没有找到对应的模块工厂
    const moduleFactory = this.dependencyFactories.get(dependency.constructor);
    if (!moduleFactory) {
      throw new Error(`No dependency factory available for this dependency type: ${dependency.constructor.name}`);
    }

    //
    // 创建模块
    //
    moduleFactory.create(
      {
        contextInfo: { issuer: "", compiler: this.compiler.name },
        context: context,
        dependencies: [dependency]
      },

      /**
       * 当模块创建完成时触发
       * @param {Module} 模块
       */
      (err, module) => {
        // 处理错误
        if (err) {
          return errorAndCallback(new EntryModuleNotFoundError(err));
        }

        //
        // 记录 创建模块耗时
        //
        let afterFactory;
        if (this.profile) {
          if (!module.profile) {
            module.profile = {};
          }
          afterFactory = Date.now();
          module.profile.factory = afterFactory - start;
        }

        // 添加模块
        const result = this.addModule(module);

        //
        // result = false 已构建的模块实例
        // onModule --> callback()
        //
        if (!result) {
          module = this.getModule(module);

          onModule(module);

          if (this.profile) {
            const afterBuilding = Date.now();
            module.profile.building = afterBuilding - afterFactory;
          }

          return callback(null, module);
        }

        //
        // result = Module 处理 缓存的模块
        // onModule() --> buildModule() --> callback()
        //
        if (result instanceof Module) {
          if (this.profile) {
            result.profile = module.profile;
          }

          module = result;

          onModule(module);

          moduleReady.call(this);

          return;
        }

        //
        // 处理未构建的模块
        //
        onModule(module);

        // 构建模块
        this.buildModule(module, false, null, null, (err) => {
          if (err) {
            return errorAndCallback(err);
          }

          if (this.profile) {
            const afterBuilding = Date.now();
            module.profile.building = afterBuilding - afterFactory;
          }

          moduleReady.call(this);
        });

        function moduleReady() {
          this.processModuleDependencies(module, err => {
            if (err) {
              return callback(err);
            }

            return callback(null, module);
          });
        }
      });
  }

  /**
   * 构建模块
   * 
   * @param {Module} module 
   * @param {Boolean} optional 
   * @param {} origin 
   * @param {Dependency[]} dependencies 
   * @param {Function} thisCallback 
   * 
   * @returns {Function}
   * 
   * @memberof Compilation
   */
  buildModule(module, optional, origin, dependencies, thisCallback) {
    this.applyPlugins1("build-module", module);

    // 正在被构建 , 保存回调函数 , 直接返回
    if (module.building) {
      return module.building.push(thisCallback);
    }

    const building = module.building = [thisCallback];

    //
    // addEntry是异步并发的 , 避免多次重复执行回调函数
    // 收集回调函数 , 统一延迟到模块构建成功之后处理
    // 构造依赖链式是并发的
    // 积压回调函数 , 等该模块构造完毕之后 , 再一并触发
    //
    function callback(err) {
      module.building = undefined;
      building.forEach(cb => cb(err));
    }

    // 构建模块
    module.build(
      this.options,
      this, this.resolvers.normal,
      this.inputFileSystem,
      (error) => {
        //
        // 处理错误
        //
        const errors = module.errors;
        for (let indexError = 0; indexError < errors.length; indexError++) {
          const err = errors[indexError];
          err.origin = origin;
          err.dependencies = dependencies;
          if (optional)
            this.warnings.push(err);
          else
            this.errors.push(err);
        }

        //
        // 处理警告
        //
        const warnings = module.warnings;
        for (let indexWarning = 0; indexWarning < warnings.length; indexWarning++) {
          const war = warnings[indexWarning];
          war.origin = origin;
          war.dependencies = dependencies;
          this.warnings.push(war);
        }

        // 
        // 按出现位置排序
        //
        module.dependencies.sort(Dependency.compare);

        if (error) {
          this.applyPlugins2("failed-module", module, error);
          return callback(error);
        }

        this.applyPlugins1("succeed-module", module);

        // 执行回调函数
        return callback();
      });
  }

  /**
	 * 处理模块的依赖
   * 
   * 1. 收集模块的所有依赖块
   * 2. 并发构建依赖块中的模块依赖
   * 
	 * @param {Module} module 模块实例
	 * @param {Function} callback 
	 */
  processModuleDependencies(module, callback) {
    // 依赖列表
    const dependencies = [];

    /**
     * 将依赖添加到依赖列表中 ( 确保不重复 )
     */
    function addDependency(dep) {
      for (let i = 0; i < dependencies.length; i++) {
        if (dep.isEqualResource(dependencies[i][0])) {
          return dependencies[i].push(dep);
        }
      }

      dependencies.push([dep]);
    }

    /**
     * 找出依赖块的所有依赖
     * 
     * @param {DependenciesBlock[]} block 
     */
    function addDependenciesBlock(block) {
      // 找出block中 , 所有的依赖
      if (block.dependencies) {
        // forEach
        iterationOfArrayCallback(block.dependencies, addDependency);
      }

      // 递归找出block中 , 所有的依赖块中所有依赖
      if (block.blocks) {
        iterationOfArrayCallback(block.blocks, addDependenciesBlock);
      }

      // 找出block中 , 所有依赖块变量中的所有依赖
      if (block.variables) {
        iterationBlockVariable(block.variables, addDependency);
      }
    }

    // 找出module中的所有依赖
    addDependenciesBlock(module);

    this.addModuleDependencies(
      module,
      dependencies,
      this.bail,
      null,
      true,
      callback
    );
  }

	/**
	 * 添加模块依赖
   * 1. 构建模块module中发现的模块依赖
   * 2. 并发递归的处理模块依赖的依赖
	 * @param {Module} module 模块实例
	 * @param {Dependency[]} dependencies 模块中出现的所有依赖实例
	 * @param {Boolean} bail 是否中断
	 * @param {String} cacheGroup 缓存组名
	 * @param {Boolean} recursive 是否递归处理依赖模块的依赖
	 * @param {Function} callback 回调函数
	 */
  addModuleDependencies(module, dependencies, bail, cacheGroup, recursive, callback) {
    let _this = this;
    const start = _this.profile && Date.now();

    //
    // 获得依赖对应的所有工厂实例
    // Tuple[Factory , Dependency]
    // 
    const factories = [];
    for (let i = 0; i < dependencies.length; i++) {
      const factory = _this.dependencyFactories.get(dependencies[i][0].constructor);

      if (!factory) {
        return callback(new Error(`No module factory available for dependency type: ${dependencies[i][0].constructor.name}`));
      }

      factories[i] = [factory, dependencies[i]];
    }

    // 
    // 并发构建依赖实例
    //
    asyncLib.forEach(
      factories,
      function iteratorFactory(item, callback) {
        const dependencies = item[1];

        // 处理错误 , 并执行回调
        const errorAndCallback = function errorAndCallback(err) {
          err.origin = module;
          _this.errors.push(err);

          if (bail) {
            callback(err);
          } else {
            callback();
          }
        };

        // 处理警告 , 并执行回调
        const warningAndCallback = function warningAndCallback(err) {
          err.origin = module;
          _this.warnings.push(err);
          callback();
        };

        // factory 实例
        const factory = item[0];

        // 创建模块
        factory.create(
          {
            contextInfo: {
              issuer: module.nameForCondition && module.nameForCondition(),
              compiler: _this.compiler.name
            },
            context: module.context,
            dependencies: dependencies
          },
          function factoryCallback(err, dependentModule) {
            let afterFactory;

            // 是否包含可选的依赖
            function isOptional() {
              return dependencies.filter(d => !d.optional).length === 0;
            }

            // 处理错误或异常
            function errorOrWarningAndCallback(err) {
              if (isOptional()) {
                return warningAndCallback(err);
              } else {
                return errorAndCallback(err);
              }
            }

            /**
             * 
             * @param {Dependency[]} depend 
             */
            function iterationDependencies(depend) {
              for (let index = 0; index < depend.length; index++) {
                const dep = depend[index];

                dep.module = dependentModule;
                dependentModule.addReason(module, dep);
              }
            }

            // 发生错误 , 处理 && 回调函数
            if (err) {
              return errorOrWarningAndCallback(new ModuleNotFoundError(module, err, dependencies));
            }

            // 模块被忽略或非模块依赖 , 直接跳过后续处理
            if (!dependentModule) {
              return process.nextTick(callback);
            }

            // 记录性能信息
            if (_this.profile) {
              if (!dependentModule.profile) {
                dependentModule.profile = {};
              }
              afterFactory = Date.now();
              dependentModule.profile.factory = afterFactory - start;
            }

            // 设置模块的引用者
            dependentModule.issuer = module;

            // 尝试将模块实例添加到模块队列 , 如果已存在 , 则从缓存中读取构建好的模块实例
            const newModule = _this.addModule(dependentModule, cacheGroup);

            // newModule = false 
            // 模块实例来自 , 模块已构建 , 无需构建
            if (!newModule) {
              // 从缓存中获得实例
              dependentModule = _this.getModule(dependentModule);

              if (dependentModule.optional) {
                dependentModule.optional = isOptional();
              }

              // 建立 deps --> module 的关联
              iterationDependencies(dependencies);

              // 记录性能
              if (_this.profile) {
                if (!module.profile) {
                  module.profile = {};
                }
                const time = Date.now() - start;
                if (!module.profile.dependencies || time > module.profile.dependencies) {
                  module.profile.dependencies = time;
                }
              }

              // 继续生成下一个依赖
              return process.nextTick(callback);
            }

            // 缓存中的模块 && 无需重新构建
            if (newModule instanceof Module) {
              if (_this.profile) {
                newModule.profile = dependentModule.profile;
              }

              // 修正数据
              newModule.optional = isOptional();
              newModule.issuer = dependentModule.issuer;
              dependentModule = newModule;

              iterationDependencies(dependencies);

              if (_this.profile) {
                const afterBuilding = Date.now();
                module.profile.building = afterBuilding - afterFactory;
              }

              // 是否继续递归处理 依赖模块的依赖
              if (recursive) {
                return process.nextTick(_this.processModuleDependencies.bind(_this, dependentModule, callback));
              } else {
                return process.nextTick(callback);
              }
            }

            dependentModule.optional = isOptional();
            iterationDependencies(dependencies);

            // 构建模块
            _this.buildModule(dependentModule, isOptional(), module, dependencies, err => {
              if (err) {
                return errorOrWarningAndCallback(err);
              }

              if (_this.profile) {
                const afterBuilding = Date.now();
                dependentModule.profile.building = afterBuilding - afterFactory;
              }

              // 是否继续递归处理 依赖模块的依赖
              if (recursive) {
                _this.processModuleDependencies(dependentModule, callback);
              } else {
                return callback();
              }
            });
          });
      },
      function finalCallbackAddModuleDependencies(err) {
        /**
         * 在V8中，Error对象保留对堆栈上的函数的引用。 
         * 这些警告和错误是在保留对编译的引用的闭包内创建的，
         * 因此错误泄漏了编译对象。 将_this设置为null解决V8中的以下问题。
         */
        // In V8, the Error objects keep a reference to the functions on the stack. These warnings &
        // errors are created inside closures that keep a reference to the Compilation, so errors are
        // leaking the Compilation object. Setting _this to null workarounds the following issue in V8.
        // https://bugs.chromium.org/p/chromium/issues/detail?id=612191
        _this = null;

        if (err) {
          return callback(err);
        }

        return process.nextTick(callback);
      }
    );
  }

	/**
	 * 将module添加到编译实例的模块列表中
   * 
   * 返回值
   * 1. 构建完毕 , 返回false ( 通过getModule获得实例 )
   * 2. 存在缓存 , 无需重新构建直接 , 返回模块实例
   * 3. 存在缓存需要重新构建 或 新创建的模块 , 返回true ( 表示需要进行构建 )
   * 
	 * @param {Module} module 模块实例
	 * @param {String} cacheGroup 缓存组名
	 * @returns {Boolean|Module} 
	 */
  addModule(module, cacheGroup) {
    const identifier = module.identifier();

    // 模块已经构建 , 那么返回false
    if (this._modules[identifier]) {
      return false;
    }

    // 获得key
    const cacheName = (cacheGroup || "m") + identifier;

    //
    // 读取缓存
    //
    if (this.cache && this.cache[cacheName]) {
      // 获得缓存的模块
      const cacheModule = this.cache[cacheName];

      let rebuild = true;

      if (!cacheModule.error &&                           // 没有出错
        cacheModule.cacheable &&                          // 可缓存
        this.fileTimestamps && this.contextTimestamps) {  // 有时间戳
        rebuild = cacheModule.needRebuild(
          this.fileTimestamps,
          this.contextTimestamps
        );
      }

      // 不需要重新构建
      if (!rebuild) {
        cacheModule.disconnect();

        this._modules[identifier] = cacheModule;
        this.modules.push(cacheModule);

        // 保存错误和警告
        cacheModule.errors.forEach(err => this.errors.push(err), this);
        cacheModule.warnings.forEach(err => this.warnings.push(err), this);

        return cacheModule;
      } else {
        module.lastId = cacheModule.id;
      }
    }

    // 撤销构建 -- 销毁构建相关的所有信息
    module.unbuild();

    //
    // 维护
    //
    this._modules[identifier] = module;

    if (this.cache) {
      this.cache[cacheName] = module;
    }

    this.modules.push(module);

    return true;
  }

	/**
	 * 获得编译过程中 , 已经出现类的同名模块的实例
	 * @param {Module} module 模块实例 
   * @returns {Module} 模块实例
	 */
  getModule(module) {
    const identifier = module.identifier();

    return this._modules[identifier];
  }

  /**
   * 根据标识查找模块实例
   * 
   * @param {String} identifier 标识
   * @returns {Module} 返回模块实例
   * @memberof Compilation
   */
  findModule(identifier) {
    return this._modules[identifier];
  }



  // ----------------------------------------------------------------
  // ************************  make 阶段完成  ************************
  // ----------------------------------------------------------------
  /**
   * make完成 -- 发出事件 , 记录错误和警告信息
   * 
   * @memberof Compilation
   */
  finish() {
    const modules = this.modules;

    this.applyPlugins1("finish-modules", modules);

    for (let index = 0; index < modules.length; index++) {
      const module = modules[index];

      // 记录警告和错误
      this.reportDependencyErrorsAndWarnings(module, [module]);
    }
  }




  // ----------------------------------------------------------------
  // ************************  seal 打包阶段  ************************
  // ----------------------------------------------------------------
  /**
   * 打包
   * 1. 从入口块开始 
   * 
   * @param {Function} callback 打包完成之后调用的回调函数
   * 
   * @memberof Compilation
   */
  seal(callback) {
    const self = this;

    // emit "seal"
    self.applyPlugins0("seal");

    self.nextFreeModuleIndex = 0;
    self.nextFreeModuleIndex2 = 0;

    /**
     * 所有入口块
     * 将依赖块都添加到相应的块中 , 为打包代码做准备
     */
    self.preparedChunks.forEach(preparedChunk => {
      // 获得模块实例
      const module = preparedChunk.module;

      // 存储块
      const chunk = self.addChunk(preparedChunk.name, module);

      // 创建入口点 , 将chunk作为入口点的初始块
      const entrypoint = self.entrypoints[chunk.name] = new Entrypoint(chunk.name);
      entrypoint.unshiftChunk(chunk);


      /**
       * 建立Chunk与Module的关联关系
       * Chunk与Module , m : n
       */
      chunk.addModule(module);
      module.addChunk(chunk);

      // 保存入口模块
      chunk.entryModule = module;

      // 为模块分配index
      self.assignIndex(module);

      // 为以入口块为根节点的模块依赖树中的节点分配各自的深度值
      self.assignDepth(module);

      // 将依赖树中的依赖块添加到相应的块中
      self.processDependenciesBlockForChunk(module, chunk);
    });

    // 按线索树索引,排序模块列表
    self.sortModules(self.modules);

    self.applyPlugins0("optimize");

    //
    // 优化 modules 
    //
    while (self.applyPluginsBailResult1("optimize-modules-basic", self.modules) ||
      self.applyPluginsBailResult1("optimize-modules", self.modules) ||
      self.applyPluginsBailResult1("optimize-modules-advanced", self.modules)); // eslint-disable-line no-extra-semi

    self.applyPlugins1("after-optimize-modules", self.modules);

    //
    // 优化chunks
    // 
    while (self.applyPluginsBailResult1("optimize-chunks-basic", self.chunks) ||
      self.applyPluginsBailResult1("optimize-chunks", self.chunks) ||
      self.applyPluginsBailResult1("optimize-chunks-advanced", self.chunks)); // eslint-disable-line no-extra-semi
    self.applyPlugins1("after-optimize-chunks", self.chunks);


    self.applyPluginsAsyncSeries("optimize-tree", self.chunks, self.modules, function sealPart2(err) {
      if (err) {
        return callback(err);
      }

      self.applyPlugins2("after-optimize-tree", self.chunks, self.modules);

      const shouldRecord = self.applyPluginsBailResult("should-record") !== false;

      //
      // 处理模块的顺序 , ids
      // 
      self.applyPlugins2("revive-modules", self.modules, self.records);
      self.applyPlugins1("optimize-module-order", self.modules);
      self.applyPlugins1("advanced-optimize-module-order", self.modules);
      self.applyPlugins1("before-module-ids", self.modules);
      self.applyPlugins1("module-ids", self.modules);
      self.applyModuleIds();  // 为模块列表中的模块分配ID
      self.applyPlugins1("optimize-module-ids", self.modules);
      self.applyPlugins1("after-optimize-module-ids", self.modules);

      // 根据模块ID , 重新排序模块列表
      self.sortItemsWithModuleIds();

      //
      // 处理块的顺序 , ids
      //
      self.applyPlugins2("revive-chunks", self.chunks, self.records);
      self.applyPlugins1("optimize-chunk-order", self.chunks);
      self.applyPlugins1("before-chunk-ids", self.chunks);
      self.applyChunkIds();
      self.applyPlugins1("optimize-chunk-ids", self.chunks);
      self.applyPlugins1("after-optimize-chunk-ids", self.chunks);

      // 根据Chunk ID , 重新排序模块列表
      self.sortItemsWithChunkIds();

      if (shouldRecord)
        self.applyPlugins2("record-modules", self.modules, self.records);

      if (shouldRecord)
        self.applyPlugins2("record-chunks", self.chunks, self.records);

      //
      // 生成编译内容的信息摘要
      //
      self.applyPlugins0("before-hash");
      self.createHash();
      self.applyPlugins0("after-hash");
      if (shouldRecord) self.applyPlugins1("record-hash", self.records);

      //
      // 创建模块中包含的资源
      //
      self.applyPlugins0("before-module-assets");
      self.createModuleAssets();

      //
      //创建块中包含的资源
      //
      if (self.applyPluginsBailResult("should-generate-chunk-assets") !== false) {
        self.applyPlugins0("before-chunk-assets");
        self.createChunkAssets();
      }

      self.applyPlugins1("additional-chunk-assets", self.chunks);


      // 汇总编译时出现的依赖
      self.summarizeDependencies();

      if (shouldRecord)
        self.applyPlugins2("record", self, self.records);

      self.applyPluginsAsync("additional-assets", err => {
        if (err) {
          return callback(err);
        }

        self.applyPluginsAsync("optimize-chunk-assets", self.chunks, err => {
          if (err) {
            return callback(err);
          }

          self.applyPlugins1("after-optimize-chunk-assets", self.chunks);

          self.applyPluginsAsync("optimize-assets", self.assets, err => {
            if (err) {
              return callback(err);
            }
            self.applyPlugins1("after-optimize-assets", self.assets);
            if (self.applyPluginsBailResult("need-additional-seal")) {
              self.unseal();
              
              return self.seal(callback);
            }
            return self.applyPluginsAsync("after-seal", callback);
          });
        });
      });
    });
  }

  /**
   * 向块列表添加一个指定起源模块的块. 
   * 若块存在,只需使用将模块module添加到块的起源模块列表即可
   * 
   * @param {String} name 块名
   * @param {Module} module 模块实例
   * @param {SourceLocation} [loc] 
   * @returns {Chunk} 返回块的实例
   * 
   * @memberof Compilation
   */
  addChunk(name, module, loc) {
    // 如果命名块已经存在 , 那么将模块添加到块中即可
    if (name) {
      if (Object.prototype.hasOwnProperty.call(this.namedChunks, name)) {
        const chunk = this.namedChunks[name];
        if (module) {
          chunk.addOrigin(module, loc);
        }

        return chunk;
      }
    }

    const chunk = new Chunk(name, module, loc);
    this.chunks.push(chunk);
    if (name) {
      this.namedChunks[name] = chunk;
    }

    return chunk;
  }

  /**
   * 建立模块依赖树的线索
   * 
   * 1. 
   * 
   * @param {Module} module 根模块节点 ( 入口节点 )
   * 
   * @memberof Compilation
   */
  assignIndex(module) {
    const _this = this;

    /**
     * 队列
     * 
     */
    const queue = [
      () => {
        assignIndexToModule(module);
      }
    ];

    function assignIndexToModule(module) {
      // enter module
      if (typeof module.index !== "number") {
        module.ndex = _this.nextFreeModuleIndex++;

        // leave module
        queue.push(() => module.index2 = _this.nextFreeModuleIndex2++);

        // enter it as block
        assignIndexToDependencyBlock(module);
      }
    }

    function assignIndexToDependencyBlock(block) {
      let allDependencies = [];

      function iteratorDependency(d) {
        allDependencies.push(d);
      }

      function iteratorBlock(b) {
        queue.push(() => assignIndexToDependencyBlock(b));
      }

      // 找出所有的注入变量中的依赖
      if (block.variables) {
        iterationBlockVariable(block.variables, iteratorDependency);
      }

      // 找出所有依赖
      if (block.dependencies) {
        iterationOfArrayCallback(block.dependencies, iteratorDependency);
      }

      // 递归找出异步块中的所有依赖
      if (block.blocks) {
        const blocks = block.blocks;
        let indexBlock = blocks.length;

        while (indexBlock--) {
          iteratorBlock(blocks[indexBlock]);
        }
      }

      let indexAll = allDependencies.length;
      while (indexAll--) {
        iteratorAllDependencies(allDependencies[indexAll]);
      }
    }

    function iteratorAllDependencies(d) {
      queue.push(() => assignIndexToDependency(d));
    }

    function assignIndexToDependency(dependency) {
      if (dependency.module) {
        queue.push(() => assignIndexToModule(dependency.module));
      }
    }

    /**
     * 执行
     */
    while (queue.length) {
      queue.pop()();
    }
  }

  /**
   * 为以模块module根节点的模块依赖树中的节点分配各自的深度值
   * 
   * @param {Module} module 根模块节点 ( 入口节点 )
   * 
   * @memberof Compilation
   */
  assignDepth(module) {
    function assignDepthToModule(module, depth) {
      // enter module
      if (typeof module.depth === "number" && module.depth <= depth) return;
      module.depth = depth;

      // enter it as block
      assignDepthToDependencyBlock(module, depth + 1);
    }

    function assignDepthToDependency(dependency, depth) {
      if (dependency.module) {
        queue.push(() => assignDepthToModule(dependency.module, depth));
      }
    }

    function assignDepthToDependencyBlock(block, depth) {
      function iteratorDependency(d) {
        assignDepthToDependency(d, depth);
      }

      function iteratorBlock(b) {
        assignDepthToDependencyBlock(b, depth);
      }

      if (block.variables) {
        iterationBlockVariable(block.variables, iteratorDependency);
      }

      if (block.dependencies) {
        iterationOfArrayCallback(block.dependencies, iteratorDependency);
      }

      if (block.blocks) {
        iterationOfArrayCallback(block.blocks, iteratorBlock);
      }
    }

    const queue = [() => {
      assignDepthToModule(module, 0);
    }];
    while (queue.length) {
      queue.pop()();
    }
  }

  /**
   * 将依赖树中的依赖块添加到相应的块中
   * 处理指定块chunk与指定分块block的依赖
   *  1. 建立 chunk <--> dependency 的关系
   *  2. 建立 chunk <--> block 的关系
   * 
   * @param {DependenciesBlock} block 依赖块
   * @param {Chunk} chunk 块
   * 
   * @memberof Compilation
   */
  processDependenciesBlockForChunk(block, chunk) {
    /**
     * 处理依赖 -- 将模块依赖对应的模块添加到块中
     * @param {Dependency} d 
     */
    const iteratorDependency = d => {
      let { module, weak } = d

      // 忽略不是模块的依赖
      if (!module) {
        return;
      }

      // 是否是弱引用. 
      // 如果是弱引用 , 那么构建块时 , 将不会包含模块的具体内容
      if (weak) {
        return;
      }

      /**
       * 尝试将模块添加到块中
       * 
       * 如果 块中不包含该模块
       * 那么 继续处理
       * 否则 不做任何操作
       */
      if (chunk.addModule(module)) {
        module.addChunk(chunk);

        queue.push([module, chunk]);
      }
    };

    /**
     * 处理异步块 -- 
     * @param {Block} b 
     */
    const iteratorBlock = b => {
      let c;

      if (!b.chunks) {
        // 创建一个新的块
        c = this.addChunk(b.chunkName, b.module, b.loc);

        b.chunks = [c]; // block -- 存储包含该异步依赖块的块
        c.addBlock(b);  // chunk -- 存储包含的异步块
      } else {
        // 
        c = b.chunks[0];
      }

      // 维护块与块之间的父子关系
      chunk.addChunk(c);  // 父块添加子块的引用
      c.addParent(chunk); // 子块添加父块的引用

      // add 处理任务
      queue.push([b, c]);
    };

    const queue = [
      [block, chunk]
    ];

    // 递归遍历 , 将所有依赖块都添加到响应的块中
    while (queue.length) {
      const queueItem = queue.pop();

      block = queueItem[0]; // 依赖块
      chunk = queueItem[1]; // 包含依赖块的块

      // 遍历注入变量 , 将其中的模块依赖中的模块添加块中
      if (block.variables) {
        iterationBlockVariable(block.variables, iteratorDependency);
      }

      // 遍历依赖 , 模块依赖中的模块添加块中
      if (block.dependencies) {
        iterationOfArrayCallback(block.dependencies, iteratorDependency);
      }

      // 遍历分块
      if (block.blocks) {
        iterationOfArrayCallback(block.blocks, iteratorBlock);
      }
    }
  }

  /**
   * 模块排序 -- 按先序遍历顺序排序模块列表
   * 排序顺序 : ASC
   * 
   * @param {Module[]} modules 
   * 
   * @memberof Compilation
   */
  sortModules(modules) {
    modules.sort((a, b) => {
      if (a.index < b.index) return -1;
      if (a.index > b.index) return 1;
      return 0;
    });
  }

  /**
   * 为模块列表中的模块分配ID
   * 
   * 
   * @memberof Compilation
   */
  applyModuleIds() {
    let unusedIds = [];         // 没有被使用的数字id
    let nextFreeModuleId = 0;   // 下一个没使用的数字id
    let usedIds = [];           // 已使用的id
    // TODO consider Map when performance has improved https://gist.github.com/sokra/234c077e1299b7369461f1708519c392
    const usedIdMap = Object.create(null);

    // 收集已使用的id -- record文件中读取出来的id
    if (this.usedModuleIds) {
      Object.keys(this.usedModuleIds).forEach(key => {
        const id = this.usedModuleIds[key];
        if (!usedIdMap[id]) {
          usedIds.push(id);
          usedIdMap[id] = true;
        }
      });
    }

    // 收集已使用的id -- 自定义的id
    const modules1 = this.modules;
    for (let indexModule1 = 0; indexModule1 < modules1.length; indexModule1++) {
      const module1 = modules1[indexModule1];
      if (module1.id && !usedIdMap[module1.id]) {
        usedIds.push(module1.id);
        usedIdMap[module1.id] = true;
      }
    }

    // 从已使用id中找出类型为数字的 , 并且是最大的.
    // 从 0 ~ max , 找出没有被使用的数字id
    if (usedIds.length > 0) {
      let usedIdMax = -1;
      for (let index = 0; index < usedIds.length; index++) {
        const usedIdKey = usedIds[index];

        if (typeof usedIdKey !== "number") {
          continue;
        }

        usedIdMax = Math.max(usedIdMax, usedIdKey);
      }

      let lengthFreeModules = nextFreeModuleId = usedIdMax + 1;

      while (lengthFreeModules--) {
        if (!usedIdMap[lengthFreeModules]) {
          unusedIds.push(lengthFreeModules);
        }
      }
    }

    const modules2 = this.modules;
    for (let indexModule2 = 0; indexModule2 < modules2.length; indexModule2++) {
      const module2 = modules2[indexModule2];

      /**
       * id 没有被赋值
       *   如果 有较小的数字id没有使用
       *   那么 取出其中的一个使用
       *   否则 使用较大的数字id ( nextFreeModuleId ++ )
       */
      if (module2.id === null) {
        if (unusedIds.length > 0)
          module2.id = unusedIds.pop();
        else
          module2.id = nextFreeModuleId++;
      }
    }
  }

  /**
   * 为块列表中的块分配ID
   * 
   * @memberof Compilation
   */
  applyChunkIds() {
    const unusedIds = [];
    let nextFreeChunkId = 0;

    function getNextFreeChunkId(usedChunkIds) {
      const keyChunks = Object.keys(usedChunkIds);
      let result = -1;

      for (let index = 0; index < keyChunks.length; index++) {
        const usedIdKey = keyChunks[index];
        const usedIdValue = usedChunkIds[usedIdKey];

        if (typeof usedIdValue !== "number") {
          continue;
        }

        result = Math.max(result, usedIdValue);
      }

      return result;
    }

    if (this.usedChunkIds) {
      nextFreeChunkId = getNextFreeChunkId(this.usedChunkIds) + 1;
      let index = nextFreeChunkId;
      while (index--) {
        if (this.usedChunkIds[index] !== index) {
          unusedIds.push(index);
        }
      }
    }

    const chunks = this.chunks;
    for (let indexChunk = 0; indexChunk < chunks.length; indexChunk++) {
      const chunk = chunks[indexChunk];
      if (chunk.id === null) {
        if (unusedIds.length > 0)
          chunk.id = unusedIds.pop();
        else
          chunk.id = nextFreeChunkId++;
      }
      if (!chunk.ids) {
        chunk.ids = [chunk.id];
      }
    }
  }

  /**
   * 根据模块id , 重新排序模块列 , 同时对模块列表和块列表中的各项重新排序
   * @memberof Compilation
   */
  sortItemsWithModuleIds() {
    // 按id升序排列模块列表
    this.modules.sort(byId);

    // 排序模块的项
    const modules = this.modules;
    for (let indexModule = 0; indexModule < modules.length; indexModule++) {
      modules[indexModule].sortItems();
    }

    // 排序块的项
    const chunks = this.chunks;
    for (let indexChunk = 0; indexChunk < chunks.length; indexChunk++) {
      chunks[indexChunk].sortItems();
    }
  }

  /**
   * 根据块id , 重新块列表 , 同时对模块列表和块列表中的各项重新排序
   * @memberof Compilation
   */
  sortItemsWithChunkIds() {
    this.chunks.sort(byId);

    const modules = this.modules;
    for (let indexModule = 0; indexModule < modules.length; indexModule++) {
      modules[indexModule].sortItems();
    }

    const chunks = this.chunks;
    for (let indexChunk = 0; indexChunk < chunks.length; indexChunk++) {
      chunks[indexChunk].sortItems();
    }
  }

  /**
   * 生成编译内容摘要
   * @memberof Compilation
   */
  createHash() {
    const outputOptions = this.outputOptions;
    const hashFunction = outputOptions.hashFunction;          // 散列算法
    const hashDigest = outputOptions.hashDigest;              // 生成散列时 , 使用的加盐值
    const hashDigestLength = outputOptions.hashDigestLength;  // 散列摘要的长度
    const hash = crypto.createHash(hashFunction);             // 创建哈希实例

    if (outputOptions.hashSalt) {
      hash.update(outputOptions.hashSalt);
    }

    // 为Template 更新生成内容摘要的原始值
    this.mainTemplate.updateHash(hash);
    this.chunkTemplate.updateHash(hash);
    this.moduleTemplate.updateHash(hash);

    this.children.forEach(function (child) {
      hash.update(child.hash);
    });

    // clone needed as sort below is inplace mutation
    const chunks = this.chunks.slice();

    /**
     * 将有运行时的块排到后面去 ( 因为有运行时的块的hash , 依赖没有运行时的快 )
		 * sort here will bring all "falsy" values to the beginning
		 * this is needed as the "hasRuntime()" chunks are dependent on the
		 * hashes of the non-runtime chunks.
		 */
    chunks.sort((a, b) => {
      const aEntry = a.hasRuntime();
      const bEntry = b.hasRuntime();

      if (aEntry && !bEntry) return 1;  // 
      if (!aEntry && bEntry) return -1; // 

      return 0;
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkHash = crypto.createHash(hashFunction);

      // 为Chunk 更新生成内容摘要的原始值
      if (outputOptions.hashSalt)
        chunkHash.update(outputOptions.hashSalt);
      chunk.updateHash(chunkHash);

      // 为Template 更新生成内容摘要的原始值
      if (chunk.hasRuntime()) {
        this.mainTemplate.updateHashForChunk(chunkHash, chunk);
      } else {
        this.chunkTemplate.updateHashForChunk(chunkHash, chunk);
      }

      this.applyPlugins2("chunk-hash", chunk, chunkHash);

      // 生成摘要
      chunk.hash = chunkHash.digest(hashDigest);

      // 更新编译的hash
      hash.update(chunk.hash);

      chunk.renderedHash = chunk.hash.substr(0, hashDigestLength);
    }

    // 生成摘要
    this.fullHash = hash.digest(hashDigest);
    this.hash = this.fullHash.substr(0, hashDigestLength);
  }

  /**
   * 生成模块中包含的资源
   * 
   * 
   * @memberof Compilation
   */
  createModuleAssets() {
    for (let i = 0; i < this.modules.length; i++) {
      const module = this.modules[i];
      if (module.assets) {
        Object.keys(module.assets).forEach((assetName) => {
          const fileName = this.getPath(assetName);
          this.assets[fileName] = module.assets[assetName];

          this.applyPlugins2("module-asset", module, fileName);
        });
      }
    }
  }

  /**
   * 生成块对应的资源内容
   * 
   * 
   * @memberof Compilation
   */
  createChunkAssets() {
    const outputOptions = this.outputOptions;
    const filename = outputOptions.filename;            // 入口文件模板
    const chunkFilename = outputOptions.chunkFilename;  // 块文件模板

    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      chunk.files = [];

      const chunkHash = chunk.hash;
      let source;
      let file;

      //
      // 获得文件模板
      // 是初始块 -- 使用 ouput.filename
      // 非初始块 -- 使用 ouput.chunkFilename
      //
      const filenameTemplate = chunk.filenameTemplate
        ? chunk.filenameTemplate
        : chunk.isInitial()
          ? filename
          : chunkFilename;

      try {
        const useChunkHash = !chunk.hasRuntime() ||
          (
            this.mainTemplate.useChunkHash &&
            this.mainTemplate.useChunkHash(chunk)
          );

        // 
        const usedHash = useChunkHash
          ? chunkHash
          : this.fullHash;

        const cacheName = "c" + chunk.id;

        // 读取缓存
        if (this.cache &&
          this.cache[cacheName] &&
          this.cache[cacheName].hash === usedHash) {
          source = this.cache[cacheName].source;
        } else {

          // 
          // render -- 根据模板生成最终的源代码
          // 1. 有运行时 -- 主模板
          // 2. 无运行时 -- chunk 模板
          if (chunk.hasRuntime()) {
            source = this.mainTemplate.render(
              this.hash,
              chunk,
              this.moduleTemplate,
              this.dependencyTemplates);
          } else {
            source = this.chunkTemplate.render(chunk,
              this.moduleTemplate,
              this.dependencyTemplates);
          }

          // 设置缓存
          if (this.cache) {
            this.cache[cacheName] = {
              hash: usedHash,
              source: source = (source instanceof CachedSource ? source : new CachedSource(source))
            };
          }
        }

        // 根据文件模板生成文件路径
        file = this.getPath(filenameTemplate, {
          noChunkHash: !useChunkHash,
          chunk
        });

        if (this.assets[file])
          throw new Error(`Conflict: Multiple assets emit to the same filename ${file}`);

        // 
        // 保存生成的asset
        //
        this.assets[file] = source;
        chunk.files.push(file);

        // emit "chunk-asset"
        this.applyPlugins2("chunk-asset", chunk, file);
      } catch (err) {
        this.errors.push(new ChunkRenderError(chunk, file || filenameTemplate, err));
      }
    }
  }

  /**
   * 汇总编译时出现的依赖
   * 
   * 
   * @memberof Compilation
   */
  summarizeDependencies() {
    function filterDups(array) {
      const newArray = [];
      for (let i = 0; i < array.length; i++) {
        if (i === 0 || array[i - 1] !== array[i])
          newArray.push(array[i]);
      }
      return newArray;
    }

    this.fileDependencies = (this.compilationDependencies || []).slice();
    this.contextDependencies = [];
    this.missingDependencies = [];

    const children = this.children;
    for (let indexChildren = 0; indexChildren < children.length; indexChildren++) {
      const child = children[indexChildren];

      this.fileDependencies = this.fileDependencies.concat(child.fileDependencies);
      this.contextDependencies = this.contextDependencies.concat(child.contextDependencies);
      this.missingDependencies = this.missingDependencies.concat(child.missingDependencies);
    }

    const modules = this.modules;
    for (let indexModule = 0; indexModule < modules.length; indexModule++) {
      const module = modules[indexModule];
      
      // 收集模块中的文件依赖
      if (module.fileDependencies) {
        const fileDependencies = module.fileDependencies;
        for (let indexFileDep = 0; indexFileDep < fileDependencies.length; indexFileDep++) {
          this.fileDependencies.push(fileDependencies[indexFileDep]);
        }
      }

      // 收集上下文中的依赖
      if (module.contextDependencies) {
        const contextDependencies = module.contextDependencies;
        for (let indexContextDep = 0; indexContextDep < contextDependencies.length; indexContextDep++) {
          this.contextDependencies.push(contextDependencies[indexContextDep]);
        }
      }
    }
    this.errors.forEach(error => {
      if (Array.isArray(error.missing)) {
        error.missing.forEach(item => this.missingDependencies.push(item));
      }
    });

    // 排序去重
    this.fileDependencies.sort(); 
    this.fileDependencies = filterDups(this.fileDependencies);      
    this.contextDependencies.sort();
    this.contextDependencies = filterDups(this.contextDependencies);
    this.missingDependencies.sort();
    this.missingDependencies = filterDups(this.missingDependencies);
  }

  /**
   * 
   * 
   * @memberof Compilation
   */
  unseal() {
    this.applyPlugins0("unseal");
    this.chunks.length = 0;
    this.namedChunks = {};
    this.additionalChunkAssets.length = 0;
    this.assets = {};
    this.modules.forEach(module => module.unseal());
  }



  // ----------------------------------------------------------------
  // **************************  Common  ****************************
  // ----------------------------------------------------------------
  /**
   * 调用路径模板引擎 , 返回解析之后的路径
   * 
   * @param {String} filename 文件路径模板
   * @param {Object} data 解析模板时使用的数据
   * @returns {String} 返回解析之后的路径
   * 
   * @memberof Compilation 
   */
  getPath(filename, data) {
    data = data || {};
    data.hash = data.hash || this.hash;

    return this.mainTemplate.applyPluginsWaterfall("asset-path", filename, data);
  }

  /**
   * 
   * 
   * @param {any} update 
   * @memberof Compilation
   */
  modifyHash(update) {
    const outputOptions = this.outputOptions;
    const hashFunction = outputOptions.hashFunction;
    const hashDigest = outputOptions.hashDigest;
    const hashDigestLength = outputOptions.hashDigestLength;
    const hash = crypto.createHash(hashFunction);
    hash.update(this.fullHash);
    hash.update(update);
    this.fullHash = hash.digest(hashDigest);
    this.hash = this.fullHash.substr(0, hashDigestLength);
  }

  /**
   * 
   * 
   * @param {any} name 
   * @param {any} outputOptions 
   * @returns 
   * 
   * @memberof Compilation
   */
  createChildCompiler(name, outputOptions) {
    return this.compiler.createChildCompiler(this, name, outputOptions);
  }

  /**
   * 
   * 
   * 
   * @memberof Compilation
   */
  checkConstraints() {
    const usedIds = {};

    const modules = this.modules;
    for (let indexModule = 0; indexModule < modules.length; indexModule++) {
      const moduleId = modules[indexModule].id;

      if (usedIds[moduleId])
        throw new Error(`checkConstraints: duplicate module id ${moduleId}`);
    }

    const chunks = this.chunks;
    for (let indexChunk = 0; indexChunk < chunks.length; indexChunk++) {
      const chunk = chunks[indexChunk];

      if (chunks.indexOf(chunk) !== indexChunk)
        throw new Error(`checkConstraints: duplicate chunk in compilation ${chunk.debugId}`);
      chunk.checkConstraints();
    }
  }



  /**
	 * 预加载指定依赖模块
	 * @param {String} context 上下文路径
	 * @param {PrefetchDependency} dependency 预取的依赖 
	 * @param {Function} callback 回调函数
	 */
  prefetch(context, dependency, callback) {
    this._addModuleChain(
      context,
      dependency,
      function onModule(module) {
        module.prefetched = true;
        module.issuer = null;
      },
      callback
    );
  }

  /**
   * 
   * 
   * @returns 
   * 
   * @memberof Compilation
   */
  getStats() {
    return new Stats(this);
  }

  /**
   * 
   * 
   * @param {any} name 
   * @param {any} fn 
   * @memberof Compilation
   */
  templatesPlugin(name, fn) {
    this.mainTemplate.plugin(name, fn);
    this.chunkTemplate.plugin(name, fn);
  }

  /**
   * 记录构建依赖过程中发现的所有警告和异常
   * 
   * @param {Module} module 
   * @param {DependenciesBlock} blocks 
   * 
   * @memberof Compilation
   */
  reportDependencyErrorsAndWarnings(module, blocks) {
    for (let indexBlock = 0; indexBlock < blocks.length; indexBlock++) {
      const block = blocks[indexBlock];
      const dependencies = block.dependencies;

      for (let indexDep = 0; indexDep < dependencies.length; indexDep++) {
        const d = dependencies[indexDep];

        const warnings = d.getWarnings();
        if (warnings) {
          for (let indexWar = 0; indexWar < warnings.length; indexWar++) {
            const w = warnings[indexWar];

            const warning = new ModuleDependencyWarning(module, w, d.loc);
            this.warnings.push(warning);
          }
        }
        const errors = d.getErrors();
        if (errors) {
          for (let indexErr = 0; indexErr < errors.length; indexErr++) {
            const e = errors[indexErr];

            const error = new ModuleDependencyError(module, e, d.loc);
            this.errors.push(error);
          }
        }
      }

      this.reportDependencyErrorsAndWarnings(module, block.blocks);
    }
  }

  /**
   * 
   * 
   * @param {any} module 
   * @param {any} thisCallback 
   * @returns 
   * @memberof Compilation
   */
  rebuildModule(module, thisCallback) {
    if (module.variables.length || module.blocks.length)
      throw new Error("Cannot rebuild a complex module with variables or blocks");
    if (module.rebuilding) {
      return module.rebuilding.push(thisCallback);
    }
    const rebuilding = module.rebuilding = [thisCallback];

    function callback(err) {
      module.rebuilding = undefined;
      rebuilding.forEach(cb => cb(err));
    }
    const deps = module.dependencies.slice();
    this.buildModule(module, false, module, null, (err) => {
      if (err) return callback(err);

      this.processModuleDependencies(module, (err) => {
        if (err) return callback(err);
        deps.forEach(d => {
          if (d.module && d.module.removeReason(module, d)) {
            module.chunks.forEach(chunk => {
              if (!d.module.hasReasonForChunk(chunk)) {
                if (d.module.removeChunk(chunk)) {
                  this.removeChunkFromDependencies(d.module, chunk);
                }
              }
            });
          }
        });
        callback();
      });

    });
  }

  /**
   * 
   * 
   * @param {DependenciesBlock} block 
   * @param {Chunk} chunk 
   * 
   * @memberof Compilation
   */
  removeChunkFromDependencies(block, chunk) {
    const iteratorDependency = d => {
      if (!d.module) {
        return;
      }
      if (!d.module.hasReasonForChunk(chunk)) {
        if (d.module.removeChunk(chunk)) {
          this.removeChunkFromDependencies(d.module, chunk);
        }
      }
    };

    const blocks = block.blocks;
    for (let indexBlock = 0; indexBlock < blocks.length; indexBlock++) {
      const chunks = blocks[indexBlock].chunks;
      for (let indexChunk = 0; indexChunk < chunks.length; indexChunk++) {
        const blockChunk = chunks[indexChunk];
        chunk.removeChunk(blockChunk);
        blockChunk.removeParent(chunk);
        this.removeChunkFromDependencies(chunks, blockChunk);
      }
    }

    if (block.dependencies) {
      iterationOfArrayCallback(block.dependencies, iteratorDependency);
    }

    if (block.variables) {
      iterationBlockVariable(block.variables, iteratorDependency);
    }
  }
}

module.exports = Compilation;
