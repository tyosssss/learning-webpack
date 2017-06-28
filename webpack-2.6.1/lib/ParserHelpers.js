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


ParserHelpers.requireFileAsExpression = function (context, pathToModule) {
  var moduleJsPath = path.relative(context, pathToModule);
  if (!/^[A-Z]:/i.test(moduleJsPath)) {
    moduleJsPath = "./" + moduleJsPath.replace(/\\/g, "/");
  }
  return "require(" + JSON.stringify(moduleJsPath) + ")";
};

/**
 * 
 * @param {String} value
 * @returns {Boolean} 返回true , 表示后续插件fn无需执行
 */
ParserHelpers.toConstantDependency = function (value) {
  return function constDependency(expr) {
    var dep = new ConstDependency(value, expr.range);
    dep.loc = expr.loc;
    this.state.current.addDependency(dep);

    return true;
  };
};

/**
 * 
 * @param {String} value
 * @returns {Boolean}
 */
ParserHelpers.evaluateToString = function (value) {
  return function stringExpression(expr) {
    return new BasicEvaluatedExpression().setString(value).setRange(expr.range);
  };
};

/**
 * 
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
