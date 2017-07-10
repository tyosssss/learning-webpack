/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const DependenciesBlock = require("./DependenciesBlock");
const ModuleReason = require("./ModuleReason");
const Template = require("./Template");

function addToSet(set, items) {
  for (let item of items) {
    if (set.indexOf(item) < 0)
      set.push(item);
  }
}

function byId(a, b) {
  return a.id - b.id;
}

let debugId = 1000;

class Module extends DependenciesBlock {
  constructor() {
    super();
    this.context = null;
    this.reasons = [];
    this.debugId = debugId++;
    this.lastId = -1;
    this.id = null;
    this.portableId = null;
    this.index = null;
    this.index2 = null;
    this.depth = null;
    this.used = null;
    this.usedExports = null;
    this.providedExports = null;
    this.chunks = [];
    this.warnings = [];
    this.dependenciesWarnings = [];
    this.errors = [];
    this.dependenciesErrors = [];
    this.strict = false;
    this.meta = {};
  }

  unseal() {
    this.lastId = this.id;
    this.id = null;
    this.index = null;
    this.index2 = null;
    this.depth = null;
    this.chunks.length = 0;
    super.unseal();
  }

  /**
   * 
   * 
   * @param {Chunk} chunk 块实例
   * @memberof Module
   */
  addChunk(chunk) {
    let idx = this.chunks.indexOf(chunk);

    if (idx < 0)
      this.chunks.push(chunk);
  }

  /**
   * 从指定块中移除该模块
   * 
   * @param {Chunk} chunk 
   * @returns {Boolean} true=移除成功,false=移除失败
   * @memberof Module
   */
  removeChunk(chunk) {
    let idx = this.chunks.indexOf(chunk);
    
    if (idx >= 0) {
      this.chunks.splice(idx, 1);
      chunk.removeModule(this);
      return true;
    }

    return false;
  }



  /**
   * 添加模块引入原因
   * 
   * @param {Module} module 
   * @param {Dependency} dependency 
   * @memberof Module
   */
  addReason(module, dependency) {
    this.reasons.push(new ModuleReason(module, dependency));
  }

  /**
   * 
   * 
   * @param {Module} module 
   * @param {Dependency} dependency  
   * @returns 
   * @memberof Module
   */
  removeReason(module, dependency) {
    for (let i = 0; i < this.reasons.length; i++) {
      let r = this.reasons[i];
      if (r.module === module && r.dependency === dependency) {
        this.reasons.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * 
   * 
   * @param {any} chunk 
   * @returns 
   * @memberof Module
   */
  hasReasonForChunk(chunk) {
    for (let r of this.reasons) {
      if (r.chunks) {
        if (r.chunks.indexOf(chunk) >= 0)
          return true;
      } else if (r.module.chunks.indexOf(chunk) >= 0)
        return true;
    }
    return false;
  }

  /**
   * 
   * 
   * @param {Chunk} oldChunk 
   * @param {Chunk} newChunks 
   * @memberof Module
   */
  rewriteChunkInReasons(oldChunk, newChunks) {
    this.reasons.forEach(r => {
      if (!r.chunks) {
        if (r.module.chunks.indexOf(oldChunk) < 0)
          return;
        r.chunks = r.module.chunks;
      }
      r.chunks = r.chunks.reduce((arr, c) => {
        addToSet(arr, c !== oldChunk ? [c] : newChunks);
        return arr;
      }, []);
    });
  }



  /**
   * 
   * 
   * @param {any} exportName 
   * @returns 
   * @memberof Module
   */
  isUsed(exportName) {
    if (this.used === null) return exportName;
    if (!exportName) return !!this.used;
    if (!this.used) return false;
    if (!this.usedExports) return false;
    if (this.usedExports === true) return exportName;
    let idx = this.usedExports.indexOf(exportName);
    if (idx < 0) return false;
    if (this.isProvided(exportName))
      return Template.numberToIdentifer(idx);
    return exportName;
  }

  /**
   * 
   * 
   * @param {any} exportName 
   * @returns 
   * @memberof Module
   */
  isProvided(exportName) {
    if (!Array.isArray(this.providedExports))
      return null;
    return this.providedExports.indexOf(exportName) >= 0;
  }

  /**
   * 
   * 
   * @returns 
   * @memberof Module
   */
  toString() {
    return `Module[${this.id || this.debugId}]`;
  }

  /**
   * 
   * 
   * @param {any} fileTimestamps 
   * @param {any} contextTimestamps 
   * @returns 
   * @memberof Module
   */
  needRebuild(fileTimestamps, contextTimestamps) {
    return true;
  }

  /**
   * 更新生成内容摘要的原始值
   * 
   * @param {crypto.hash} hash hash实例
   */
  updateHash(hash) {
    hash.update(this.id + "" + this.used);
    hash.update(JSON.stringify(this.usedExports));

    super.updateHash(hash);
  }

  /**
   * 
   * 
   * @memberof Module
   */
  sortItems() {
    super.sortItems();

    this.chunks.sort(byId);
    this.reasons.sort((a, b) => byId(a.module, b.module));
  }

  /**
   * 撤销构建 -- 销毁构建相关的所有信息
   * 
   * @memberof Module
   */
  unbuild() {
    this.disconnect();
  }

  /**
   * 销毁构建信息
   * 
   * @memberof Module
   */
  disconnect() {
    this.reasons.length = 0;
    this.lastId = this.id;
    this.id = null;
    this.index = null;
    this.index2 = null;
    this.depth = null;
    this.used = null;
    this.usedExports = null;
    this.providedExports = null;
    this.chunks.length = 0;

    super.disconnect();
  }
}

Object.defineProperty(Module.prototype, "entry", {
  configurable: false,
  get() {
    throw new Error("Module.entry was removed. Use Chunk.entryModule");
  },
  set() {
    throw new Error("Module.entry was removed. Use Chunk.entryModule");
  }
});

Module.prototype.identifier = null;
Module.prototype.readableIdentifier = null;
Module.prototype.build = null;
Module.prototype.source = null;
Module.prototype.size = null;
Module.prototype.nameForCondition = null;

module.exports = Module;
