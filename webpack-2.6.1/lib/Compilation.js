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

function iterationBlockVariable(variables, fn) {
  for (let indexVariable = 0; indexVariable < variables.length; indexVariable++) {
    let varDep = variables[indexVariable].dependencies;
    for (let indexVDep = 0; indexVDep < varDep.length; indexVDep++) {
      fn(varDep[indexVDep]);
    }
  }
}

function iterationOfArrayCallback(arr, fn) {
  for (let index = 0; index < arr.length; index++) {
    fn(arr[index]);
  }
}

class Compilation extends Tapable {
  constructor(compiler) {
    super();
    this.compiler = compiler;
    this.resolvers = compiler.resolvers;
    this.inputFileSystem = compiler.inputFileSystem;

    const options = this.options = compiler.options;
    this.outputOptions = options && options.output;
    this.bail = options && options.bail;
    this.profile = options && options.profile;
    this.performance = options && options.performance;

    //
    // 创建模板实例
    //
    this.mainTemplate = new MainTemplate(this.outputOptions);
    this.chunkTemplate = new ChunkTemplate(this.outputOptions);
    this.hotUpdateChunkTemplate = new HotUpdateChunkTemplate(this.outputOptions);
    this.moduleTemplate = new ModuleTemplate(this.outputOptions);

    //
    // 初始化属性
    //

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

    this.entrypoints = {};
    this.chunks = [];
    this.namedChunks = {};
    this.modules = [];
    this._modules = {};
    this.cache = null;
    this.records = null;
    this.nextFreeModuleIndex = undefined;
    this.nextFreeModuleIndex2 = undefined;
    this.additionalChunkAssets = [];

    /**
     * 
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
		 * 存储模块工厂与依赖类型的对应关系 
		 * @type {Map<Dependency,ModuleFactory>}
		 */
    this.dependencyFactories = new Map();

		/**
		 * 
		 * @type {Map}
		 */
    this.dependencyTemplates = new Map();
  }

	/**
	 * 添加入口
	 * @param {String} context 上下文路径
	 * @param {Dependency} entry 入口模块依赖
	 * @param {String} name 入口的名称
	 * @param {Function} callback 回调函数 
	 */
  addEntry(context, entry, name, callback) {
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
          return callback(err);
        }

        if (module) {
          slot.module = module;
        } else {
          const idx = this.preparedChunks.indexOf(slot);
          this.preparedChunks.splice(idx, 1);
        }

        return callback(null, module);
      });
  }

	/**
	 * 
	 * @param {String} context 
	 * @param {Dependency} dependency 
	 * @param {Function} callback 
	 */
  prefetch(context, dependency, callback) {
    this._addModuleChain(context, dependency, module => {

      module.prefetched = true;
      module.issuer = null;

    }, callback);
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

    //
    // 处理错误
    // 
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

    if (typeof dependency !== "object" ||
      dependency === null ||
      !dependency.constructor) {
      throw new Error("Parameter 'dependency' must be a Dependency");
    }

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

        const result = this.addModule(module);

        //
        // 处理旧模块 -- 编译过程中 , 已经出现过的模块
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
        // 处理新的模块 -- 编译过程中 , 第一次出现的模块
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

        onModule(module);

        //
        // 构建模块
        //
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
   * @param {} dependencies 
   * @param {Function} thisCallback 
   * 
   * @memberof Compilation
   */
  buildModule(module, optional, origin, dependencies, thisCallback) {
    this.applyPlugins1("build-module", module);

    if (module.building) {
      return module.building.push(thisCallback);
    }

    const building = module.building = [thisCallback];

    //
    // 构造依赖链式是并发的
    // 积压回调函数 , 等该模块构造完毕之后 , 再一并触发
    //
    function callback(err) {
      module.building = undefined;
      building.forEach(cb => cb(err));
    }

    module.build(
      this.options,
      this, this.resolvers.normal,
      this.inputFileSystem,
      (error) => {
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

        const warnings = module.warnings;
        for (let indexWarning = 0; indexWarning < warnings.length; indexWarning++) {
          const war = warnings[indexWarning];
          war.origin = origin;
          war.dependencies = dependencies;
          this.warnings.push(war);
        }
        module.dependencies.sort(Dependency.compare);
        if (error) {
          this.applyPlugins2("failed-module", module, error);
          return callback(error);
        }
        this.applyPlugins1("succeed-module", module);
        return callback();
      });
  }

  /**
	 * 处理模块依赖
	 * @param {Module} module 
	 * @param {*} callback 
	 */
  processModuleDependencies(module, callback) {
    const dependencies = [];

    function addDependency(dep) {
      for (let i = 0; i < dependencies.length; i++) {
        if (dep.isEqualResource(dependencies[i][0])) {
          return dependencies[i].push(dep);
        }
      }
      dependencies.push([dep]);
    }

    function addDependenciesBlock(block) {
      if (block.dependencies) {
        iterationOfArrayCallback(block.dependencies, addDependency);
      }
      if (block.blocks) {
        iterationOfArrayCallback(block.blocks, addDependenciesBlock);
      }
      if (block.variables) {
        iterationBlockVariable(block.variables, addDependency);
      }
    }

    addDependenciesBlock(module);

    this.addModuleDependencies(module, dependencies, this.bail, null, true, callback);
  }

	/**
	 * 
	 * @param {Module} module 
	 * @param {S} dependencies 
	 * @param {Boolean} bail 
	 * @param {String} cacheGroup 
	 * @param {Boolean} recursive 是否递归
	 * @param {Function} callback 
	 */
  addModuleDependencies(module, dependencies, bail, cacheGroup, recursive, callback) {
    let _this = this;
    const start = _this.profile && Date.now();

    const factories = [];
    for (let i = 0; i < dependencies.length; i++) {
      const factory = _this.dependencyFactories.get(dependencies[i][0].constructor);
      if (!factory) {
        return callback(new Error(`No module factory available for dependency type: ${dependencies[i][0].constructor.name}`));
      }
      factories[i] = [factory, dependencies[i]];
    }
    asyncLib.forEach(factories, function iteratorFactory(item, callback) {
      const dependencies = item[1];

      const errorAndCallback = function errorAndCallback(err) {
        err.origin = module;
        _this.errors.push(err);
        if (bail) {
          callback(err);
        } else {
          callback();
        }
      };
      const warningAndCallback = function warningAndCallback(err) {
        err.origin = module;
        _this.warnings.push(err);
        callback();
      };

      const factory = item[0];
      factory.create({
        contextInfo: {
          issuer: module.nameForCondition && module.nameForCondition(),
          compiler: _this.compiler.name
        },
        context: module.context,
        dependencies: dependencies
      }, function factoryCallback(err, dependentModule) {
        let afterFactory;

        function isOptional() {
          return dependencies.filter(d => !d.optional).length === 0;
        }

        function errorOrWarningAndCallback(err) {
          if (isOptional()) {
            return warningAndCallback(err);
          } else {
            return errorAndCallback(err);
          }
        }

        function iterationDependencies(depend) {
          for (let index = 0; index < depend.length; index++) {
            const dep = depend[index];
            dep.module = dependentModule;
            dependentModule.addReason(module, dep);
          }
        }

        if (err) {
          return errorOrWarningAndCallback(new ModuleNotFoundError(module, err, dependencies));
        }
        if (!dependentModule) {
          return process.nextTick(callback);
        }
        if (_this.profile) {
          if (!dependentModule.profile) {
            dependentModule.profile = {};
          }
          afterFactory = Date.now();
          dependentModule.profile.factory = afterFactory - start;
        }

        dependentModule.issuer = module;
        const newModule = _this.addModule(dependentModule, cacheGroup);

        if (!newModule) { // from cache
          dependentModule = _this.getModule(dependentModule);

          if (dependentModule.optional) {
            dependentModule.optional = isOptional();
          }

          iterationDependencies(dependencies);

          if (_this.profile) {
            if (!module.profile) {
              module.profile = {};
            }
            const time = Date.now() - start;
            if (!module.profile.dependencies || time > module.profile.dependencies) {
              module.profile.dependencies = time;
            }
          }

          return process.nextTick(callback);
        }

        if (newModule instanceof Module) {
          if (_this.profile) {
            newModule.profile = dependentModule.profile;
          }

          newModule.optional = isOptional();
          newModule.issuer = dependentModule.issuer;
          dependentModule = newModule;

          iterationDependencies(dependencies);

          if (_this.profile) {
            const afterBuilding = Date.now();
            module.profile.building = afterBuilding - afterFactory;
          }

          if (recursive) {
            return process.nextTick(_this.processModuleDependencies.bind(_this, dependentModule, callback));
          } else {
            return process.nextTick(callback);
          }
        }

        dependentModule.optional = isOptional();

        iterationDependencies(dependencies);

        _this.buildModule(dependentModule, isOptional(), module, dependencies, err => {
          if (err) {
            return errorOrWarningAndCallback(err);
          }

          if (_this.profile) {
            const afterBuilding = Date.now();
            dependentModule.profile.building = afterBuilding - afterFactory;
          }

          if (recursive) {
            _this.processModuleDependencies(dependentModule, callback);
          } else {
            return callback();
          }
        });

      });
    }, function finalCallbackAddModuleDependencies(err) {
      // In V8, the Error objects keep a reference to the functions on the stack. These warnings &
      // errors are created inside closures that keep a reference to the Compilation, so errors are
      // leaking the Compilation object. Setting _this to null workarounds the following issue in V8.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=612191
      _this = null;

      if (err) {
        return callback(err);
      }

      return process.nextTick(callback);
    });
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
	 * 将module添加到编译实例的模块列表中
	 * @param {Module} module 模块
	 * @param {String} cacheGroup 缓存组名
	 * @returns {Boolean} true=新增成功 , false=读取缓存
	 */
  addModule(module, cacheGroup) {
    const identifier = module.identifier();

    if (this._modules[identifier]) {
      return false;
    }

    //
    // 缓存 && add
    //
    const cacheName = (cacheGroup || "m") + identifier;

    //
    // 读取缓存
    //
    if (this.cache && this.cache[cacheName]) {
      const cacheModule = this.cache[cacheName];

      let rebuild = true;

      if (!cacheModule.error &&
        cacheModule.cacheable &&
        this.fileTimestamps &&
        this.contextTimestamps) {
        rebuild = cacheModule.needRebuild(this.fileTimestamps, this.contextTimestamps);
      }

      if (!rebuild) {
        cacheModule.disconnect();

        this._modules[identifier] = cacheModule;
        this.modules.push(cacheModule);

        cacheModule.errors.forEach(err => this.errors.push(err), this);
        cacheModule.warnings.forEach(err => this.warnings.push(err), this);

        return cacheModule;
      } else {
        module.lastId = cacheModule.id;
      }
    }

    // 撤销构建 -- 销毁构建相关的所有信息
    module.unbuild();

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
   * 
   * 
   * @param {any} identifier 
   * @returns 
   * @memberof Compilation
   */
  findModule(identifier) {
    return this._modules[identifier];
  }



  /**
   * 编译完成 -- 发出事件 , 记录错误和警告信息
   * 
   * @memberof Compilation
   */
  finish() {
    const modules = this.modules;

    this.applyPlugins1("finish-modules", modules);

    for (let index = 0; index < modules.length; index++) {
      const module = modules[index];
      this.reportDependencyErrorsAndWarnings(module, [module]);
    }
  }

  unseal() {
    this.applyPlugins0("unseal");
    this.chunks.length = 0;
    this.namedChunks = {};
    this.additionalChunkAssets.length = 0;
    this.assets = {};
    this.modules.forEach(module => module.unseal());
  }

  /**
   * 打包
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

    //
    // 处理已就绪的块
    //
    self.preparedChunks.forEach(preparedChunk => {
      const module = preparedChunk.module;

      // 存储块
      const chunk = self.addChunk(preparedChunk.name, module);

      // 创建入口点
      const entrypoint = self.entrypoints[chunk.name] = new Entrypoint(chunk.name);
      entrypoint.unshiftChunk(chunk);

      // 块与模块建立关系
      chunk.addModule(module);
      module.addChunk(chunk);

      chunk.entryModule = module;

      // 为模块分配index
      self.assignIndex(module);

      // 为模块分配depth
      self.assignDepth(module);

      // 处理入口块chunk与入口模块的依赖模块
      self.processDependenciesBlockForChunk(module, chunk);
    });

    // 根据module.index , 对模块列表进行排序
    self.sortModules(self.modules);

    self.applyPlugins0("optimize");

    while (self.applyPluginsBailResult1("optimize-modules-basic", self.modules) ||
      self.applyPluginsBailResult1("optimize-modules", self.modules) ||
      self.applyPluginsBailResult1("optimize-modules-advanced", self.modules)); // eslint-disable-line no-extra-semi
    self.applyPlugins1("after-optimize-modules", self.modules);

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

      self.applyPlugins2("revive-modules", self.modules, self.records);
      self.applyPlugins1("optimize-module-order", self.modules);
      self.applyPlugins1("advanced-optimize-module-order", self.modules);
      self.applyPlugins1("before-module-ids", self.modules);
      self.applyPlugins1("module-ids", self.modules);
      self.applyModuleIds();
      self.applyPlugins1("optimize-module-ids", self.modules);
      self.applyPlugins1("after-optimize-module-ids", self.modules);

      // 根据模块ID , 重新排序模块列表
      self.sortItemsWithModuleIds();

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
      // 生成Hash
      //
      self.applyPlugins0("before-hash");
      self.createHash();
      self.applyPlugins0("after-hash");
      if (shouldRecord) self.applyPlugins1("record-hash", self.records);

      //
      // 
      //
      self.applyPlugins0("before-module-assets");
      self.createModuleAssets();

      //
      //
      //
      if (self.applyPluginsBailResult("should-generate-chunk-assets") !== false) {
        self.applyPlugins0("before-chunk-assets");
        self.createChunkAssets();
      }
      self.applyPlugins1("additional-chunk-assets", self.chunks);
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
   * 模块排序 -- 根据index
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
   * 报告依赖错误或警告
   * 
   * @param {any} module 
   * @param {any} blocks 
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
   * 向块列表添加一个指定起源模块的块. 若块存在,只需使用将模块module添加到块的起源模块列表即可
   * 
   * @param {String} name 块名
   * @param {Module} module 模块
   * @param {Object} loc 模块位置
   * @returns {Chunk} 返回块
   * 
   * @memberof Compilation
   */
  addChunk(name, module, loc) {
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
   * 
   * 
   * @param {Module} module 
   * 
   * @memberof Compilation
   */
  assignIndex(module) {
    const _this = this;

    const queue = [() => {
      assignIndexToModule(module);
    }];

    const iteratorAllDependencies = d => {
      queue.push(() => assignIndexToDependency(d));
    };

    function assignIndexToModule(module) {
      // enter module
      if (typeof module.index !== "number") {
        module.index = _this.nextFreeModuleIndex++;

        // leave module
        queue.push(() => module.index2 = _this.nextFreeModuleIndex2++);

        // enter it as block
        assignIndexToDependencyBlock(module);
      }
    }

    function assignIndexToDependency(dependency) {
      if (dependency.module) {
        queue.push(() => assignIndexToModule(dependency.module));
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

      if (block.variables) {
        iterationBlockVariable(block.variables, iteratorDependency);
      }

      if (block.dependencies) {
        iterationOfArrayCallback(block.dependencies, iteratorDependency);
      }
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

    while (queue.length) {
      queue.pop()();
    }
  }

  /**
   * 
   * 
   * @param {Module} module 
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
   * 处理指定块chunk与指定分块block的依赖
   *  1. 建立 chunk <--> dependency 的关系
   *  2. 建立 chunk <--> block 的关系
   * 
   * @param {Module} block 分块
   * @param {Chunk} chunk 块
   * 
   * @memberof Compilation
   */
  processDependenciesBlockForChunk(block, chunk) {
		/**
     * 
     * @param {Block} b 
     */
    const iteratorBlock = b => {
      let c;

      //
      // 分块和块建立关系
      //
      if (!b.chunks) {
        c = this.addChunk(b.chunkName, b.module, b.loc);
        b.chunks = [c];
        c.addBlock(b);
      } else {
        c = b.chunks[0];
      }
      chunk.addChunk(c);
      c.addParent(chunk);
      queue.push([b, c]);
    };

    /**
     * 
     * @param {Dependency} d 
     */
    const iteratorDependency = d => {
      if (!d.module) {
        return;
      }
      if (d.weak) {
        return;
      }

      //
      // 块和模块建立关系
      //
      if (chunk.addModule(d.module)) {
        d.module.addChunk(chunk);
        queue.push([d.module, chunk]);
      }
    };

    const queue = [
      [block, chunk]
    ];

    //
    // 遍历算法 : BFS
    //
    while (queue.length) {
      const queueItem = queue.pop();
      block = queueItem[0];
      chunk = queueItem[1];

      // 遍历
      if (block.variables) {
        iterationBlockVariable(block.variables, iteratorDependency);
      }

      // 遍历依赖
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
   * 
   * 
   * @param {any} block 
   * @param {any} chunk 
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

  /**
   * 
   * 
   * 
   * @memberof Compilation
   */
  applyModuleIds() {
    let unusedIds = [];
    let nextFreeModuleId = 0;
    let usedIds = [];
    // TODO consider Map when performance has improved https://gist.github.com/sokra/234c077e1299b7369461f1708519c392
    const usedIdMap = Object.create(null);
    if (this.usedModuleIds) {
      Object.keys(this.usedModuleIds).forEach(key => {
        const id = this.usedModuleIds[key];
        if (!usedIdMap[id]) {
          usedIds.push(id);
          usedIdMap[id] = true;
        }
      });
    }

    const modules1 = this.modules;
    for (let indexModule1 = 0; indexModule1 < modules1.length; indexModule1++) {
      const module1 = modules1[indexModule1];
      if (module1.id && !usedIdMap[module1.id]) {
        usedIds.push(module1.id);
        usedIdMap[module1.id] = true;
      }
    }

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
      if (module2.id === null) {
        if (unusedIds.length > 0)
          module2.id = unusedIds.pop();
        else
          module2.id = nextFreeModuleId++;
      }
    }
  }

  /**
   * 
   * 
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
   * 根据模块ID,
   * 
   * 
   * @memberof Compilation
   */
  sortItemsWithModuleIds() {
    // 以id的大小 , 排序模块列表
    this.modules.sort(byId);

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
   * 
   * 
   * 
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
   * 
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

      if (module.fileDependencies) {
        const fileDependencies = module.fileDependencies;
        for (let indexFileDep = 0; indexFileDep < fileDependencies.length; indexFileDep++) {
          this.fileDependencies.push(fileDependencies[indexFileDep]);
        }
      }
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
   * 
   * @memberof Compilation
   */
  createHash() {
    const outputOptions = this.outputOptions;
    const hashFunction = outputOptions.hashFunction;
    const hashDigest = outputOptions.hashDigest;
    const hashDigestLength = outputOptions.hashDigestLength;
    const hash = crypto.createHash(hashFunction);
    if (outputOptions.hashSalt)
      hash.update(outputOptions.hashSalt);
    this.mainTemplate.updateHash(hash);
    this.chunkTemplate.updateHash(hash);
    this.moduleTemplate.updateHash(hash);
    this.children.forEach(function (child) {
      hash.update(child.hash);
    });
    // clone needed as sort below is inplace mutation
    const chunks = this.chunks.slice();
		/**
		 * sort here will bring all "falsy" values to the beginning
		 * this is needed as the "hasRuntime()" chunks are dependent on the
		 * hashes of the non-runtime chunks.
		 */
    chunks.sort((a, b) => {
      const aEntry = a.hasRuntime();
      const bEntry = b.hasRuntime();
      if (aEntry && !bEntry) return 1;
      if (!aEntry && bEntry) return -1;
      return 0;
    });
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkHash = crypto.createHash(hashFunction);
      if (outputOptions.hashSalt)
        chunkHash.update(outputOptions.hashSalt);
      chunk.updateHash(chunkHash);
      if (chunk.hasRuntime()) {
        this.mainTemplate.updateHashForChunk(chunkHash, chunk);
      } else {
        this.chunkTemplate.updateHashForChunk(chunkHash, chunk);
      }
      this.applyPlugins2("chunk-hash", chunk, chunkHash);
      chunk.hash = chunkHash.digest(hashDigest);
      hash.update(chunk.hash);
      chunk.renderedHash = chunk.hash.substr(0, hashDigestLength);
    }
    this.fullHash = hash.digest(hashDigest);
    this.hash = this.fullHash.substr(0, hashDigestLength);
  }

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
        // 没有运行时 或 
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

        // 
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
   * 根据文件模板 , 生成最终的文件路径
   * 
   * @param {String} filename 文件模板
   * @param {Object} data 数据
   * @returns 
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
}

module.exports = Compilation;
