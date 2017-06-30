/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
const path = require("path");

const BasicEvaluatedExpression = require("./BasicEvaluatedExpression");
const ConstDependency = require("./dependencies/ConstDependency");
const UnsupportedFeatureWarning = require("./UnsupportedFeatureWarning");

const ParserHelpers = exports;

/**
 * @param {Parser} parser
 * @param {String} name
 * @param {Expression} expression
 */
ParserHelpers.addParsedVariableToModule = function (parser, name, expression) {
  if (!parser.state.current.addVariable) return false;
  
  var deps = [];
  parser.parse(expression, {
    current: {
      addDependency: function (dep) {
        dep.userRequest = name;
        deps.push(dep);
      }
    },
    module: parser.state.module
  });
  
  parser.state.current.addVariable(name, expression, deps);
  
  return true;
};

/**
 * 
 */
ParserHelpers.requireFileAsExpression = function (context, pathToModule) {
  var moduleJsPath = path.relative(context, pathToModule);
  if (!/^[A-Z]:/i.test(moduleJsPath)) {
    moduleJsPath = "./" + moduleJsPath.replace(/\\/g, "/");
  }
  return "require(" + JSON.stringify(moduleJsPath) + ")";
};

/**
 * 返回一个 "将指定值转换为ConstDependecy , 同时将依赖添加到当前Module中" 的事件处理器
 * @param {String} value 常量值
 * @returns {Function} 返回处理器
 */
ParserHelpers.toConstantDependency = function (value) {
  /**
   * 
   * @param {Expression} expr 表达式
   * @returns {Boolean} true , 表示无需触发后序的事件处理器
   * @this Parser
   */
  return function constDependency(expr) {
    var dep = new ConstDependency(value, expr.range);
    dep.loc = expr.loc;

    this.state.current.addDependency(dep);

    return true;
  };
};

/**
 * 返回一个 "将求得的值转换为指定字符串value" 的事件处理器
 * @param {String} value 字符串
 * @returns {Function} 返回处理器
 */
ParserHelpers.evaluateToString = function (value) {
  return function stringExpression(expr) {
    return new BasicEvaluatedExpression()
      .setString(value)
      .setRange(expr.range);
  };
};

/**
 * 返回一个 "将求得的值转换为布尔"的事件处理器
 * @param {String} value
 * @returns {Boolean}
 */
ParserHelpers.evaluateToBoolean = function (value) {
  return function booleanExpression(expr) {
    return new BasicEvaluatedExpression().setBoolean(value).setRange(expr.range);
  };
};

/**
 * 
 * @param {String} value
 * @returns {Boolean}
 */
ParserHelpers.expressionIsUnsupported = function (message) {
  return function unsupportedExpression(expr) {
    var dep = new ConstDependency("(void 0)", expr.range);
    dep.loc = expr.loc;
    this.state.current.addDependency(dep);
    if (!this.state.module) return;
    this.state.module.warnings.push(new UnsupportedFeatureWarning(this.state.module, message));
    return true;
  };
};

/**
 * 
 * @returns {Boolean}
 */
ParserHelpers.skipTraversal = function skipTraversal() {
  return true;
};

/**
 * 
 * @returns {Boolean}
 */
ParserHelpers.approve = function approve() {
  return true;
};
