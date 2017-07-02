/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

/**
 * 已经被执行的表达式 ( 表达式的执行结果 )
 * 
 * Null           null
 * String         字符窜
 * Number         数字
 * Boolean        布尔
 * RegExp         正则表达式
 * Conditional
 * Array          数组
 * ConstArray
 * Identifier     标志符
 * Wrapped        
 * TemplateString 模板字符串
 */
class BasicEvaluatedExpression {
  constructor() {
    this.range = null;
  }

  isNull() {
    return !!this.null;
  }

  isString() {
    return Object.prototype.hasOwnProperty.call(this, "string");
  }

  isNumber() {
    return Object.prototype.hasOwnProperty.call(this, "number");
  }

  isBoolean() {
    return Object.prototype.hasOwnProperty.call(this, "bool");
  }

  isRegExp() {
    return Object.prototype.hasOwnProperty.call(this, "regExp");
  }

  isConditional() {
    return Object.prototype.hasOwnProperty.call(this, "options");
  }

  isArray() {
    return Object.prototype.hasOwnProperty.call(this, "items");
  }

  isConstArray() {
    return Object.prototype.hasOwnProperty.call(this, "array");
  }

  isIdentifier() {
    return Object.prototype.hasOwnProperty.call(this, "identifier");
  }

  isWrapped() {
    return Object.prototype.hasOwnProperty.call(this, "prefix") ||
      Object.prototype.hasOwnProperty.call(this, "postfix");
  }

  isTemplateString() {
    return Object.prototype.hasOwnProperty.call(this, "quasis");
  }

  /**
   * 将表达式的求值结果转换为bool类型
   * 
   * 返回undefined :
   *  -- 
   * 
   * @returns {Boolean|undefined} 返回最终的布尔类型
   */
  asBool() {
    if (this.isBoolean()) return this.bool;
    else if (this.isNull()) return false;
    else if (this.isString()) return !!this.string;
    else if (this.isNumber()) return !!this.number;
    else if (this.isRegExp()) return true;
    else if (this.isArray()) return true;
    else if (this.isConstArray()) return true;
    else if (this.isWrapped()) {
      return (
        (
          this.prefix && 
          this.prefix.asBool()
        ) || 
        (
          this.postfix && 
          this.postfix.asBool() ? true : undefined
        )
      );
    }
    else if (this.isTemplateString()) {
      if (this.quasis.length === 1) return this.quasis[0].asBool();
      for (let i = 0; i < this.quasis.length; i++) {
        if (this.quasis[i].asBool()) return true;
      }
      // can't tell if string will be empty without executing
    }

    return undefined;
  }

	/**
	 * 设置 结果为字符串
	 * @param {String} str 
	 */
  setString(str) {
    if (str === null)
      delete this.string;
    else
      this.string = str;
    return this;
  }

  /**
   * 设置 结果为null
   */
  setNull() {
    this.null = true;
    return this;
  }

	/**
	 * 设置 结果为数字值
	 * @param {Number} num 
	 */
  setNumber(num) {
    if (num === null)
      delete this.number;
    else
      this.number = num;

    return this;
  }

  /**
   * 设置 布尔值
   * @param {Boolean} bool 
   */
  setBoolean(bool) {
    if (bool === null)
      delete this.bool;
    else
      this.bool = bool;
    return this;
  }

  /**
   * 设置 正则表达式
   * @param {RegExp} bool 
   */
  setRegExp(regExp) {
    if (regExp === null)
      delete this.regExp;
    else
      this.regExp = regExp;
    return this;
  }

	/**
	 * 设置 表达式的标志符
	 * @param {String} identifier 
	 */
  setIdentifier(identifier) {
    if (identifier === null)
      delete this.identifier;
    else
      this.identifier = identifier;
    return this;
  }

	/**
	 * 
	 * @param {Any} prefix 
	 * @param {Any} postfix 
	 */
  setWrapped(prefix, postfix) {
    this.prefix = prefix;
    this.postfix = postfix;
    
    return this;
  }

	/**
	 * 
	 */
  unsetWrapped() {
    delete this.prefix;
    delete this.postfix;
    return this;
  }

  /**
   * 
   * @param {any} options 
   * @returns 
   * @memberof BasicEvaluatedExpression
   */
  setOptions(options) {
    if (options === null)
      delete this.options;
    else
      this.options = options;
    return this;
  }

  /**
   * 设置 数组元素
   * @param {Array} items 
   */
  setItems(items) {
    if (items === null)
      delete this.items;
    else
      this.items = items;
    return this;
  }
  
  /**
   * 设置数组
   * @param {Array} array 
   */
  setArray(array) {
    if (array === null)
      delete this.array;
    else
      this.array = array;
    return this;
  }

  setTemplateString(quasis) {
    if (quasis === null)
      delete this.quasis;
    else
      this.quasis = quasis;
    return this;
  }

  addOptions(options) {
    if (!this.options) this.options = [];
    options.forEach(item => {
      this.options.push(item);
    }, this);
    return this;
  }

	/**
	 * 设置 表达式求值的结果所对应的代码范围 ( 即表示那段代码的求值结果 )
   * 
   * // 对以下表达式求值
   * // 那么 range 的范围应该是 [5,6] // ==> a
   * var a = 1;
   * 
	 * @param {Tuple[start,end]} range 
	 */
  setRange(range) {
    this.range = range;
    return this;
  }
}

module.exports = BasicEvaluatedExpression;
