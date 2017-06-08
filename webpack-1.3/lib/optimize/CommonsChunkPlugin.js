/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var nextIdent = 0;

function CommonsChunkPlugin(options) {
	if(arguments.length > 1) {
		throw new Error("Deprecation notice: CommonsChunkPlugin now only takes a single argument. Either an options " +
			"object *or* the name of the chunk.\n" +
			"Example: if your old code looked like this:\n" +
			"    new webpack.optimize.CommonsChunkPlugin('vendor', 'vendor.bundle.js')\n\n" +
			"You would change it to:\n" +
			"    new webpack.optimize.CommonsChunkPlugin({ name: 'vendor', filename: 'vendor.bundle.js' })\n\n" +
			"The available options are:\n" +
			"    name: string\n" +
			"    names: string[]\n" +
			"    filename: string\n" +
			"    minChunks: number\n" +
			"    async: boolean\n" +
			"    minSize: number\n");
	}

	if(Array.isArray(options) || typeof options === "string") {
		options = {
			name: options
		};
	}

	this.chunkNames = options.name || options.names;	// 块名
	this.filenameTemplate = options.filename;					// 公共块的文件名
	this.minChunks = options.minChunks;								// 公共块的提取条件
	this.selectedChunks = options.chunks;							// 要提取公共块的块
	if(options.children) this.selectedChunks = false;	// 选中的块
	this.async = options.async;												// 是否异步
	this.minSize = options.minSize;										//
	this.ident = __filename + (nextIdent++);
}

module.exports = CommonsChunkPlugin;
CommonsChunkPlugin.prototype.apply = function(compiler) {
	var chunkNames = this.chunkNames;
	var filenameTemplate = this.filenameTemplate;
	var minChunks = this.minChunks;
	var selectedChunks = this.selectedChunks;
	var async = this.async;
	var minSize = this.minSize;
	var ident = this.ident;

	compiler.plugin("this-compilation", function(compilation) {

		// chunks -- 所有的块
		compilation.plugin(["optimize-chunks", "optimize-extracted-chunks"], function(chunks) {
			// only optimize once
			if(compilation[ident]) return;
			compilation[ident] = true;

			// 存储 公共块
			var commonChunks;

			//
			// 获得公共块
			//
			if(!chunkNames && (selectedChunks === false || async)) {

				// 选择所有块
				commonChunks = chunks;
			}
			else if(Array.isArray(chunkNames) || typeof chunkNames === "string") {

				// 按名称过滤块
				commonChunks = [].concat(chunkNames).map(function(chunkName) {
					var chunk = chunks.filter(function(chunk) {
						return chunk.name === chunkName;
					})[0];

					// 块名不在块中,则添加一个新块
					if(!chunk) {
						chunk = this.addChunk(chunkName);
					}

					return chunk;
				}, this);
			}
			else {
				throw new Error("Invalid chunkNames argument");
			}



			//
			// 依次遍历公共块
			// commonChunk {Chunk} 公共块
			// idx {Number} 索引号
			//
			commonChunks.forEach(function processCommonChunk(commonChunk, idx) {

				//
				var usedChunks; // 存储 "待提取公共模块的块"



				//
				// 获得 "待提取公共模块的块"
				//
				if(Array.isArray(selectedChunks)) { // 设置了chunks

					// 过滤掉公共块本身 , 以及不在selectedChunks中的块
					usedChunks = chunks.filter(function(chunk) {
						if(chunk === commonChunk) return false;
						return selectedChunks.indexOf(chunk.name) >= 0;
					});
				}
				else if(selectedChunks === false || async) { // children = true || asyn = true

					// async    = true , usedChunks = commonChunk的所有子块
					// children = true , usedChunks = 只有一个父级的块
					usedChunks = (commonChunk.chunks || []).filter(function(chunk) {
						// we can only move modules from this chunk if the "commonChunk" is the only parent
						return async || chunk.parents.length === 1;
					});
				}
				else {
					// 多个父级 , 弹出错误
					// CommonsChunkPlugin：在正常模式下运行时，不允许使用非进入块
					if(commonChunk.parents.length > 0) {
						compilation.errors.push(new Error("CommonsChunkPlugin: While running in normal mode it's not allowed to use a non-entry chunk (" + commonChunk.name + ")"));
						return;
					}

					// usedChunks = 入口文件 ( 有运行时的文件 )
					usedChunks = chunks.filter(function(chunk) {
						var found = commonChunks.indexOf(chunk);
						if(found >= idx) return false;
						return chunk.hasRuntime();
					});
				}



				//
				// 处理 async -- 创建异步块
				//
				if(async) {
					var asyncChunk = this.addChunk(typeof async === "string"
						? async
						: undefined);

					asyncChunk.chunkReason = "async commons chunk";
					asyncChunk.extraAsync = true;
					asyncChunk.addParent(commonChunk);
					commonChunk.addChunk(asyncChunk);
					commonChunk = asyncChunk;
				}



				//
				// 计算出"准备被提取的公共模块"
				//
				var reallyUsedModules = [];			// 存储 "准备被提取的公共模块" ( 不会重复 )

				if(minChunks !== Infinity) {
					var commonModulesCount = [];	// 存储 "模块对应的使用次数"
					var commonModules = [];				// 存储 "所有的模块" -- 去掉重复的

					// 遍历待提取块的模块 , 记录所用到的模块,以及相应的使用次数
					usedChunks.forEach(function(chunk) {
						chunk.modules.forEach(function(module) {
							var idx = commonModules.indexOf(module);

							if(idx < 0) {
								commonModules.push(module);
								commonModulesCount.push(1);
							}
							else {
								commonModulesCount[idx]++;
							}
						});
					});


					var _minChunks = (minChunks || Math.max(2, usedChunks.length))

					// 过滤 使用次数 < minChunks 或者 minChunks->true的块
					commonModulesCount.forEach(function(count, idx) {
						var module = commonModules[idx];

						if(typeof minChunks === "function") {
							if(!minChunks(module, count)) return;
						}
						else if(count < _minChunks) {
							return;
						}

						//
						reallyUsedModules.push(module);
					});
				}



				//
				// 若minSize != undefined , 则判断公共模块的尺寸是否大于minSize
				//
				if(minSize) {
					var size = reallyUsedModules.reduce(function(a, b) {
						return a + b.size();
					}, 0);

					if(size < minSize) return;
				}



				//
				// 从usedChunks中移除 "待提取的公共模块" , 然后将公共模块添加到公共块中.
				//
				var reallyUsedChunks = [];	// 存储 "被提取公共模块的块" ( 不会重复 )

				reallyUsedModules.forEach(function(module) {
					usedChunks.forEach(function(chunk) {
						if(module.removeChunk(chunk)) {
							if(reallyUsedChunks.indexOf(chunk) < 0) reallyUsedChunks.push(chunk);
						}
					});
					commonChunk.addModule(module);
					module.addChunk(commonChunk);
				});



				//
				// 调整块的关系
				//
				if(async) {
					reallyUsedChunks.forEach(function(chunk) {
						if(chunk.isInitial()) return;

						chunk.blocks.forEach(function(block) {
							block.chunks.unshift(commonChunk);
							commonChunk.addBlock(block);
						});
					});

					asyncChunk.origins = reallyUsedChunks
						.map(function(chunk) {
							return chunk.origins.map(function(origin) {
								var newOrigin = Object.create(origin);
								newOrigin.reasons = (origin.reasons || []).slice();
								newOrigin.reasons.push("async commons");
								return newOrigin;
							});
						})
						.reduce(function(arr, a) {
							arr.push.apply(arr, a);
							return arr;
						}, []);
				}
				else {
					usedChunks.forEach(function(chunk) {
						chunk.parents = [commonChunk];
						chunk.entrypoints.forEach(function(ep) {
							ep.insertChunk(commonChunk, chunk);
						});
						commonChunk.addChunk(chunk);
					});
				}



				//
				// 处理文件名模块
				//
				if(filenameTemplate)
					commonChunk.filenameTemplate = filenameTemplate;
			}, this);

			return true;
		});
	});
};
