/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const Module = require("./Module");
const RawSource = require("webpack-sources").RawSource;

class MultiModule extends Module {

  /**
   * Creates an instance of MultiModule.
   * @param {String} context 上下文路径 ( 与config.context 相同 )
   * @param {Dependency[]} dependencies 依赖列表
   * @param {String} name 模块名称
   * @memberof MultiModule
   */
  constructor(context, dependencies, name) {
    super();
    this.context = context;
    this.dependencies = dependencies;
    this.name = name;
    this.built = false;
    this.cacheable = true;
  }

  /**
   * 
   * 
   * @returns 
   * @memberof MultiModule
   */
  identifier() {
    return `multi ${this.dependencies.map((d) => d.request).join(" ")}`;
  }

  /**
   * 
   * 
   * @param {any} requestShortener 
   * @returns 
   * @memberof MultiModule
   */
  readableIdentifier(requestShortener) {
    return `multi ${this.dependencies.map((d) => requestShortener.shorten(d.request)).join(" ")}`;
  }

  /**
   * 
   * 
   * @memberof MultiModule
   */
  disconnect() {
    this.built = false;
    super.disconnect();
  }

  /**
   * 
   * 
   * @param {any} options 
   * @param {any} compilation 
   * @param {any} resolver 
   * @param {any} fs 
   * @param {any} callback 
   * @returns 
   * @memberof MultiModule
   */
  build(options, compilation, resolver, fs, callback) {
    this.built = true;
    return callback();
  }

  /**
   * 
   * 
   * @returns 
   * @memberof MultiModule
   */
  needRebuild() {
    return false;
  }

  /**
   * 
   * 
   * @returns 
   * @memberof MultiModule
   */
  size() {
    return 16 + this.dependencies.length * 12;
  }

  /**
   * 
   * 
   * @param {any} hash 
   * @memberof MultiModule
   */
  updateHash(hash) {
    hash.update("multi module");
    hash.update(this.name || "");
    super.updateHash(hash);
  }

  /**
   * 
   * 
   * @param {any} dependencyTemplates 
   * @param {any} outputOptions 
   * @returns 
   * @memberof MultiModule
   */
  source(dependencyTemplates, outputOptions) {
    const str = [];
    this.dependencies.forEach(function (dep, idx) {
      if (dep.module) {
        if (idx === this.dependencies.length - 1)
          str.push("module.exports = ");
        str.push("__webpack_require__(");
        if (outputOptions.pathinfo)
          str.push(`/*! ${dep.request} */`);
        str.push(`${JSON.stringify(dep.module.id)}`);
        str.push(")");
      } else {
        str.push("(function webpackMissingModule() { throw new Error(");
        str.push(JSON.stringify(`Cannot find module "${dep.request}"`));
        str.push("); }())");
      }
      str.push(";\n");
    }, this);
    return new RawSource(str.join(""));
  }
}

module.exports = MultiModule;
