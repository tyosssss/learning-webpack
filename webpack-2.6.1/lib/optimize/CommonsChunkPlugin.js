/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
let nextIdent = 0;

/**
 * 
 * 
 * @class CommonsChunkPlugin
 */
class CommonsChunkPlugin {
  constructor(options) {
    if (arguments.length > 1) {
      throw new Error(`Deprecation notice: CommonsChunkPlugin now only takes a single argument. Either an options
object *or* the name of the chunk.
Example: if your old code looked like this:
	new webpack.optimize.CommonsChunkPlugin('vendor', 'vendor.bundle.js')
You would change it to:
	new webpack.optimize.CommonsChunkPlugin({ name: 'vendor', filename: 'vendor.bundle.js' })
The available options are:
	name: string
	names: string[]
	filename: string
	minChunks: number
	chunks: string[]
	children: boolean
	async: boolean
	minSize: number`);
    }

    // 格式化选项
    const normalizedOptions = this.normalizeOptions(options);

    /**
     * 公共块的名称
     * @type {String[]}
     */
    this.chunkNames = normalizedOptions.chunkNames;

    /**
     * 
     * @type {String}
     */
    this.filenameTemplate = normalizedOptions.filenameTemplate;

    /**
     * 
     * @type {Number | Function}
     */
    this.minChunks = normalizedOptions.minChunks;

    /**
     * 
     * @type {Chunk[]}
     */
    this.selectedChunks = normalizedOptions.selectedChunks;

    /**
     * 
     * @type {Boolean}
     */
    this.children = normalizedOptions.children;

    /**
     * 
     * @type {Boolean}
     */
    this.async = normalizedOptions.async;

    /**
     * 块的最小尺寸 , 
     * @type {Number}
     */
    this.minSize = normalizedOptions.minSize;

    /**
     * 标识符 -- 用于识别一次公共块提取操作
     * @type {String}
     */
    this.ident = __filename + (nextIdent++);
  }

  /**
   * 格式化选项
   * 
   * @param {Object} options 
   * @returns {Object}
   * @memberof CommonsChunkPlugin
   */
  normalizeOptions(options) {
    if (Array.isArray(options)) {
      return {
        chunkNames: options,
      };
    }

    if (typeof options === "string") {
      return {
        chunkNames: [options],
      };
    }

    // options.children and options.chunk may not be used together
    if (options.children && options.chunks) {
      throw new Error("You can't and it does not make any sense to use \"children\" and \"chunk\" options together.");
    }

		/**
		 * options.async and options.filename are also not possible together
		 * as filename specifies how the chunk is called but "async" implies
		 * that webpack will take care of loading this file.
		 */
    if (options.async && options.filename) {
      throw new Error(`You can not specify a filename if you use the \"async\" option.
You can however specify the name of the async chunk by passing the desired string as the \"async\" option.`);
    }

		/**
		 * Make sure this is either an array or undefined.
		 * "name" can be a string and
		 * "names" a string or an array
		 */
    const chunkNames = typeof options.name === "string"
      ? [options.name]
      : (
        options.names
          ? [].concat(options.name || options.names)
          : undefined
      );

    return {
      chunkNames: chunkNames,
      filenameTemplate: options.filename,
      minChunks: options.minChunks,
      selectedChunks: options.chunks,
      children: options.children,
      async: options.async,
      minSize: options.minSize
    };
  }

  apply(compiler) {
    compiler.plugin("this-compilation", (compilation) => {
      compilation.plugin(["optimize-chunks", "optimize-extracted-chunks"], (chunks) => {
        // only optimize once
        if (compilation[this.ident]) {
          return;
        }

        compilation[this.ident] = true;

				/**
         * 获得目标块列表
         * 目标块 -- 提取的公共模块的公共块
         * 
				 * 基于配置项 , 创建一个公共块清单.
         * 这个清单由已存在或新建的块组成.
         *  - ( 已存在的块 ) 如果遇到的块的名称包含在chunkNames中 , 那么它应该在该列表中
         *  - ( 新建的块   ) 如果遇到的块的名称不包含在chunkNames中 , 那么新建一个块 , 并将其添加到列表中
         * 
         * Creates a list of "common"" chunks based on the options.
				 * The list is made up of preexisting or newly created chunks.
				 * - If chunk has the name as specified in the chunkNames it is put in the list
				 * - If no chunk with the name as given in chunkNames exists a new chunk is created and added to the list
				 *
				 * These chunks are the "targets" for extracted modules.
				 */
        const targetChunks = this.getTargetChunks(
          chunks,
          compilation,
          this.chunkNames,
          this.children,
          this.async
        );

        // 遍历所有目标块
        // iterate over all our new chunks
        targetChunks.forEach((targetChunk, idx) => {

					/**
           * 获得受影响的块
           * 受影响的块 -- 这些块中的"公共"块会被提取出来,移到公共块中
           * 
					 * These chunks are subject to get "common" modules extracted and moved to the common chunk
					 */
          const affectedChunks = this.getAffectedChunks(
            compilation,
            chunks,
            targetChunk,
            targetChunks,
            idx,
            this.selectedChunks,
            this.async,
            this.children
          );
          // bail if no chunk is affected
          if (!affectedChunks) {
            return;
          }

          // If we are async create an async chunk now
          // override the "commonChunk" with the newly created async one and use it as commonChunk from now on
          let asyncChunk;

          // 如果公共块作为异步块 , 那么创建异步块
          if (this.async) {
            asyncChunk = this.createAsyncChunk(compilation, this.async, targetChunk);
            targetChunk = asyncChunk; // 将创建的异步块作为当前的目标块
          }

					/**
           * 获得可提取的模块列表
					 * Check which modules are "common" and could be extracted to a "common" chunk
					 */
          const extractableModules = this.getExtractableModules(this.minChunks, affectedChunks, targetChunk);

          // If the minSize option is set check if the size extracted from the chunk is reached
          // else bail out here.
          // As all modules/commons are interlinked with each other, common modules would be extracted
          // if we reach this mark at a later common chunk. (quirky I guess).
          if (this.minSize) {
            const modulesSize = this.calculateModulesSize(extractableModules);
            // if too small, bail
            if (modulesSize < this.minSize)
              return;
          }

          // Remove modules that are moved to commons chunk from their original chunks
          // return all chunks that are affected by having modules removed - we need them later (apparently)
          const chunksWithExtractedModules = this.extractModulesAndReturnAffectedChunks(
            extractableModules,
            affectedChunks
          );

          // connect all extracted modules with the common chunk
          this.addExtractedModulesToTargetChunk(targetChunk, extractableModules);

          // set filenameTemplate for chunk
          if (this.filenameTemplate) {
            targetChunk.filenameTemplate = this.filenameTemplate;
          }

          // if we are async connect the blocks of the "reallyUsedChunk" - the ones that had modules removed -
          // with the commonChunk and get the origins for the asyncChunk (remember "asyncChunk === commonChunk" at this moment).
          // bail out
          if (this.async) {
            this.moveExtractedChunkBlocksToTargetChunk(chunksWithExtractedModules, targetChunk);
            asyncChunk.origins = this.extractOriginsOfChunksWithExtractedModules(chunksWithExtractedModules);
          } else {
            // we are not in "async" mode
            // connect used chunks with commonChunk - shouldnt this be reallyUsedChunks here?
            this.makeTargetChunkParentOfAffectedChunks(affectedChunks, targetChunk);
          }
        });

        return true;
      });
    });
  }

  /**
   * 获得目标块 -- 即存放提取模块的公共块
   * 
   * @param {Chunk} allChunks 编译时 , 遇到的所有块
   * @param {Compilaction} compilation 编译实例
   * @param {String[]} chunkNames 公共块的块名
   * @param {Boolean} children 
   * @param {Boolean} asyncOption
   * @returns {Chunk[]} 返回目标块
   * @memberof CommonsChunkPlugin
   */
  getTargetChunks(allChunks, compilation, chunkNames, children, asyncOption) {
    const asyncOrNoSelectedChunk = children || asyncOption;

    // we have specified chunk names
    if (chunkNames) {
      // map chunks by chunkName for quick access
      const allChunksNameMap = allChunks.reduce(
        (map, chunk) => {
          if (chunk.name) {
            map.set(chunk.name, chunk);
          }

          return map;
        },
        new Map()
      );

      // Ensure we have a chunk per specified chunk name.
      // Reuse existing chunks if possible
      return chunkNames.map(
        chunkName => {
          // 如果指定块名的块已存在 , 那么直接使用存在的块
          if (allChunksNameMap.has(chunkName)) {
            return allChunksNameMap.get(chunkName);
          }

          // 如果指定块名的不存在 , 新建一个块
          return compilation.addChunk(chunkName);
        }
      );
    }

    // we dont have named chunks specified, so we just take all of them
    if (asyncOrNoSelectedChunk) {
      return allChunks.filter(chunk => !chunk.isInitial());
    }

		/**
		 * No chunk name(s) was specified nor is this an async/children commons chunk
		 */
    throw new Error(`You did not specify any valid target chunk settings.
Take a look at the "name"/"names" or async/children option.`);
  }

  /**
   * 获得受映像的块
   * 
   * @param {Compilaction} compilation 编译实例
   * @param {Chunk} allChunks 编译时 , 遇到的所有块 
   * @param {Chunk} targetChunk 目标块
   * @param {Chunk[]} targetChunks 目标块列表
   * @param {Index} currentIndex 目标块在目标块列表中的位置
   * @param {Chunk[]} selectedChunks 配置的受影响块
   * @param {Boolean} asyncOption 
   * @param {Boolean} children 
   * @returns {Chunk[]} 返回受影响的块
   * @memberof CommonsChunkPlugin
   */
  getAffectedChunks(compilation, allChunks, targetChunk, targetChunks, currentIndex, selectedChunks, asyncOption, children) {
    const asyncOrNoSelectedChunk = children || asyncOption;

    // 将选中块作为受影响的块
    if (Array.isArray(selectedChunks)) {
      return allChunks.filter(chunk => {
        const notCommmonChunk = chunk !== targetChunk;  // 避免循环处理
        const isSelectedChunk = selectedChunks.indexOf(chunk.name) > -1;

        return notCommmonChunk && isSelectedChunk;
      });
    }

    if (asyncOrNoSelectedChunk) {
      // 新建的目标块 , 直接返回
      // nothing to do here
      if (!targetChunk.chunks) {
        return [];
      }

      // 仅从只有一个父级块的块中移动模块到"公共块"中
      // we can only move modules from this chunk if the "commonChunk" is the only parent
      return targetChunk.chunks.filter((chunk) => {
        return asyncOption || chunk.parents.length === 1;
      });
    }

		/**
		 * 目标块不能
		 */
    if (targetChunk.parents.length > 0) {
      compilation.errors.push(new Error("CommonsChunkPlugin: While running in normal mode it's not allowed to use a non-entry chunk (" + targetChunk.name + ")"));
      return;
    }

    /**
     * 如果我们找到一个“targetchunk”，这也是一个正常的块（意味着它可能被指定为一个条目），并且当前的目标块在它之后，并且找到的块有一个运行时使该块成为当前的“受影响”块 目标块。


为了理解这个方法看看“examples / chunkhash”，这基本上将导致运行时被提取到当前的目标块。

运行：
“运行时”是您可能在解决模块的捆绑包中看到的“webpack”块
     */
		/**
		 * If we find a "targetchunk" that is also a normal chunk (meaning it is probably specified as an entry)
		 * and the current target chunk comes after that and the found chunk has a runtime*
		 * make that chunk be an 'affected' chunk of the current target chunk.
		 *
		 * To understand what that means take a look at the "examples/chunkhash", this basically will
		 * result in the runtime to be extracted to the current target chunk.
		 *
		 * *runtime: the "runtime" is the "webpack"-block you may have seen in the bundles that resolves modules etc.
		 */
    return allChunks.filter((chunk) => {
      const found = targetChunks.indexOf(chunk);

      if (found >= currentIndex) {
        return false;
      }

      return chunk.hasRuntime();
    });
  }

  /**
   * 创建一个异步块
   * 创建一个父块是targetChunk的异步块
   * 
   * @param {Compilaction} compilation 编译实例
   * @param {Boolean|String} asyncOption 异步块配置
   * @param {Chunk} targetChunk 目标块 ( 公共块 ) 
   * @returns {Chunk} 返回创建的异步块
   * @memberof CommonsChunkPlugin
   */
  createAsyncChunk(compilation, asyncOption, targetChunk) {
    const asyncChunk = compilation.addChunk(
      typeof asyncOption === "string"
        ? asyncOption
        : undefined
    );

    asyncChunk.chunkReason = "async commons chunk";
    asyncChunk.extraAsync = true;

    asyncChunk.addParent(targetChunk);
    targetChunk.addChunk(asyncChunk);

    return asyncChunk;
  }

  /**
   * 获得可提取的模块列表
   * 
   * @param {Number | Function} minChunks 提取条件
   * @param {Chunk} usedChunks 
   * @param {Chunk} targetChunk 
   * @returns {Module[]} 返回可提取的模块列表
   * @memberof CommonsChunkPlugin
   */
  getExtractableModules(minChunks, usedChunks, targetChunk) {
    // 不提取公共模块
    if (minChunks === Infinity) {
      return [];
    }

    // 计算一个模块被多少个块包含
    // count how many chunks contain a module
    const commonModulesToCountMap = usedChunks
      .reduce(
      (map, chunk) => {
        for (let module of chunk.modules) {
          const count = map.has(module)
            ? map.get(module)
            : 0;

          map.set(module, count + 1);
        }

        return map;
      },
      new Map()
      );

    // filter by minChunks
    const moduleFilterCount = this.getModuleFilter(minChunks, targetChunk, usedChunks.length);

    // filter by condition
    const moduleFilterCondition = (module, chunk) => {
      if (!module.chunkCondition) {
        return true;
      }

      return module.chunkCondition(chunk);
    };

    return Array
      .from(commonModulesToCountMap)
      .filter(entry => {
        const module = entry[0];
        const count = entry[1];

        // if the module passes both filters, keep it.
        return moduleFilterCount(module, count) && moduleFilterCondition(module, targetChunk);
      })
      .map(entry => entry[0]);
  }

  // If minChunks is a function use that
  // otherwhise check if a module is used at least minChunks or 2 or usedChunks.length time
  /**
   * 
   * 
   * @param {Number | Function} minChunks 提取条件
   * @param {Chunk} targetChunk 
   * @param {Number} usedChunksLength 
   * @returns 
   * @memberof CommonsChunkPlugin
   */
  getModuleFilter(minChunks, targetChunk, usedChunksLength) {
    if (typeof minChunks === "function") {
      return minChunks;
    }

    const minCount = (minChunks || Math.max(2, usedChunksLength));
    const isUsedAtLeastMinTimes = (module, count) => count >= minCount;

    return isUsedAtLeastMinTimes;
  }


  /**
   * 计算出给定模块列表的总长度
   * 
   * @param {Module[]} modules 模块列表
   * @returns {Number} 返回总长度
   * @memberof CommonsChunkPlugin
   */
  calculateModulesSize(modules) {
    return modules.reduce((totalSize, module) => totalSize + module.size(), 0);
  }

  /**
   * 提取模块 , 返回受影响的块 ( 即被提取了公共模块的块 )
   * 
   * @param {Module[]} reallyUsedModules 
   * @param {Chunk[]} usedChunks 
   * @returns {Set<Chunk>}
   * @memberof CommonsChunkPlugin
   */
  extractModulesAndReturnAffectedChunks(reallyUsedModules, usedChunks) {
    return reallyUsedModules
      .reduce(
      (affectedChunksSet, module) => {
        for (let chunk of usedChunks) {
          // removeChunk returns true if the chunk was contained and succesfully removed
          // false if the module did not have a connection to the chunk in question
          if (module.removeChunk(chunk)) {
            affectedChunksSet.add(chunk);
          }
        }

        return affectedChunksSet;
      },
      new Set()
      );
  }

  /**
   * 将提取的模块添加到目标块 ( 公共块 ) 中
   * 
   * @param {Chunk} chunk 公共块
   * @param {Modules[]} modules 提取的块
   * @memberof CommonsChunkPlugin
   */
  addExtractedModulesToTargetChunk(chunk, modules) {
    for (let module of modules) {
      chunk.addModule(module);
      module.addChunk(chunk);
    }
  }

  /**
   * 
   * 
   * @param {any} chunks 
   * @param {any} targetChunk 
   * @memberof CommonsChunkPlugin
   */
  moveExtractedChunkBlocksToTargetChunk(chunks, targetChunk) {
    for (let chunk of chunks) {
      for (let block of chunk.blocks) {
        block.chunks.unshift(targetChunk);
        targetChunk.addBlock(block);
      }
    }
  }

  /**
   * 
   * 
   * @param {any} chunks 
   * @returns 
   * @memberof CommonsChunkPlugin
   */
  extractOriginsOfChunksWithExtractedModules(chunks) {
    const origins = [];

    for (let chunk of chunks) {
      for (let origin of chunk.origins) {
        const newOrigin = Object.create(origin);
        newOrigin.reasons = (origin.reasons || []).concat("async commons");
        origins.push(newOrigin);
      }
    }

    return origins;
  }


  /**
   * 
   * 
   * @param {Chunk[]} usedChunks 
   * @param {Chunk} commonChunk 
   * @memberof CommonsChunkPlugin
   */
  makeTargetChunkParentOfAffectedChunks(usedChunks, commonChunk) {
    for (let chunk of usedChunks) {
      // set commonChunk as new sole parent
      chunk.parents = [commonChunk];
      // add chunk to commonChunk
      commonChunk.addChunk(chunk);

      for (let entrypoint of chunk.entrypoints) {
        entrypoint.insertChunk(commonChunk, chunk);
      }
    }
  }
}

module.exports = CommonsChunkPlugin;
