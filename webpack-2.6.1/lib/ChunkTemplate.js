/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const ConcatSource = require("webpack-sources").ConcatSource;
const Template = require("./Template");

module.exports = class ChunkTemplate extends Template {
  constructor(outputOptions) {
    super(outputOptions);
  }

  /**
   * 
   * @param {Chunk} chunk 
   * @param {ModuleTemplate} moduleTemplate 
   * @param {DependencyTemplate[]} dependencyTemplates 
   * @returns 
   */
  render(chunk, moduleTemplate, dependencyTemplates) {
    const moduleSources = this.renderChunkModules(chunk, moduleTemplate, dependencyTemplates);
    const core = this.applyPluginsWaterfall("modules", moduleSources, chunk, moduleTemplate, dependencyTemplates);

    let source = this.applyPluginsWaterfall("render", core, chunk, moduleTemplate, dependencyTemplates);
    if (chunk.hasEntryModule()) {
      source = this.applyPluginsWaterfall("render-with-entry", source, chunk);
    }

    chunk.rendered = true;

    return new ConcatSource(source, ";");
  }

  /**
   * 更新生成内容摘要的原始值
   * 
   * @param {crypto.hash} hash hash实例
   */
  updateHash(hash) {
    hash.update("ChunkTemplate");
    hash.update("2");
    this.applyPlugins("hash", hash);
  }

  updateHashForChunk(hash, chunk) {
    this.updateHash(hash);
    this.applyPlugins("hash-for-chunk", hash, chunk);
  }
};
