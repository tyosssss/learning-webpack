/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

// polyfill from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
// using the polyfill specifically to avoid the call to `Object.defineProperty` for performance reasons
function fastFilter(fun/*, thisArg*/) {
  'use strict';

  if (this === void 0 || this === null) {
    throw new TypeError();
  }

  var t = Object(this);
  var len = t.length >>> 0;
  if (typeof fun !== 'function') {
    throw new TypeError();
  }

  var res = [];
  var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
  for (var i = 0; i < len; i++) {
    if (i in t) {
      var val = t[i];

      // NOTE: Technically this should Object.defineProperty at
      //       the next index, as push can be affected by
      //       properties on Object.prototype and Array.prototype.
      //       But that method's new, and collisions should be
      //       rare, so use the more-compatible alternative.
      if (fun.call(thisArg, val, i, t)) {
        res.push(val);
      }
    }
  }

  return res;
}

function copyProperties(from, to) {
  for (var key in from)
    to[key] = from[key];
  return to;
}

function rest(arrayLike, n) {
  return Array.prototype.slice.call(arrayLike, n)
}

/**
 * Tapable
 * 基于"事件发布/订阅"的插件架构
 * 
 * interface Plugin {
 *  public apply()
 * }
 */
function Tapable() {
  /**
   * 事件集合
   * @type {Map<eventName : String , listeners : Function[]>} 
   * 
   * {
   *  plugin1 : [fn1 , fn2 , ...] ,
   *  plugin2 : [fn1 , fn2 , ...]
   *  ...
   * }
   */
  this._plugins = {};
}

module.exports = Tapable;

/**
 * mixin
 */
Tapable.mixin = function mixinTapable(pt) {
  copyProperties(Tapable.prototype, pt);
};

/**
 * 发布事件 -- 按订阅顺序依次执行处理函数
 * 
 * sync/async : sync
 * 
 * @param {String} name 事件名称
 * @param {...Any} args 调用事件处理函数的参数
 */
Tapable.prototype.applyPlugins = function applyPlugins(name) {
  _applyPlugins(
    name,
    this,
    rest(arguments, 1)
  )
};

/**
 * 发布事件 -- 按订阅顺序依次执行处理函数 ( 无参数 )
 * 
 * sync/async : sync
 * 
 * @param {String} name 事件名称
 */
Tapable.prototype.applyPlugins0 = function applyPlugins0(name) {
  _applyPlugins(name, this)
};

/**
 * 发布事件 ( 一个参数 )
 * 
 * sync/async : sync
 * 
 * @param {String} name 事件名称
 * @param {Any} param 调用事件处理函数的参数
 */
Tapable.prototype.applyPlugins1 = function applyPlugins1(name, param) {
  _applyPlugins(name, this, param)
};

/**
 * 发布事件 ( 二个参数 )
 * 
 * sync/async : sync
 * 
 * @param {String} name 事件名称
 * @param {Any} param1 调用事件处理函数的参数1
 * @param {Any} param2 调用事件处理函数的参数2
 */
Tapable.prototype.applyPlugins2 = function applyPlugins2(name, param1, param2) {
  _applyPlugins(name, this, [param1, param2])
};

function _applyPlugins(name, context, args) {
  var plugins = context._plugins[name]

  if (!plugins) {
    return;
  }

  plugins.forEach(function (p) { p.apply(context, [args]) })
}



/**
 * 发布事件 - 按waterfall方式依次执行事件处理函数
 * 
 * sync/async : sync
 * 
 * @param {String} name 事件名称
 * @param {Any} init 初始值
 * @param {...Any} args 调用事件处理函数的参数
 * @param {Any} 返回计算出的最终值
 */
Tapable.prototype.applyPluginsWaterfall = function applyPluginsWaterfall(name, init) {
  return _applyPluginsWaterfall(
    name,
    this,
    init,
    rest(arguments, 2)
  )
};

/**
 * 发布事件 - 按waterfall方式依次执行事件处理函数
 * 
 * sync/async : sync
 * 
 * @param {String} name 事件名称
 * @param {Any} init 初始值
 * @param {Any} 返回计算出的最终值
 */
Tapable.prototype.applyPluginsWaterfall0 = function applyPluginsWaterfall0(name, init) {
  return _applyPluginsWaterfall(name, this, init)
};

function _applyPluginsWaterfall(name, context, init, args) {
  let plugins = context._plugins[name]

  if (!plugins) {
    return;
  }

  return plugins.reduce(
    (current, p) => p.apply(context, [current].concat(args)),
    init
  )
}

/**
 * 发布事件 - 依次执行事件处理函数.
 * 当某个事件处理函数有返回值时,停止调用后续的事件处理函数,并将返回值返回
 * 
 * sync/async : sync
 * 
 * @param {String} name 事件名称
 * @param {...Any} args 调用事件处理函数的参数
 */
Tapable.prototype.applyPluginsBailResult = function applyPluginsBailResult(name) {
  if (!this._plugins[name]) return;

  var args = Array.prototype.slice.call(arguments, 1);
  var plugins = this._plugins[name];

  for (var i = 0; i < plugins.length; i++) {
    var result = plugins[i].apply(this, args);
    if (typeof result !== "undefined") {
      return result;
    }
  }
};


/**
 * 发布事件 - 依次执行事件处理函数.
 * 当某个事件处理函数有返回值时,停止调用后续的事件处理函数,并将返回值返回
 * 
 * sync/async : sync
 * 
 * @param {String} name 事件名称
 * @param {Any} param 调用事件处理函数的参数
 */
Tapable.prototype.applyPluginsBailResult1 = function applyPluginsBailResult1(name, param) {
  if (!this._plugins[name]) return;

  var plugins = this._plugins[name];
  for (var i = 0; i < plugins.length; i++) {
    var result = plugins[i].call(this, param);
    if (typeof result !== "undefined") {
      return result;
    }
  }
};

/**
 * 发布事件 - 以异步方式,依次执行事件处理函数.调用每个事件处理执行完成之后,调用next函数执行下一个事件处理函数.如果发生错误或所有事件处理函数都执行了,才停止执行
 * 
 * sync/async : async
 * 
 * @param {String} name 事件名称
 * @param {...Any} args [arg0 , arg1 , ... , callback] 调用事件处理函数的参数 , 以及回调函数
 */
Tapable.prototype.applyPluginsAsyncSeries = Tapable.prototype.applyPluginsAsync = function applyPluginsAsyncSeries(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  var callback = args.pop();
  var plugins = this._plugins[name];

  if (!plugins || plugins.length === 0) {
    return callback();
  }

  var i = 0;
  var _this = this;

  var next = copyProperties(callback, function next(err) {
    if (err) {
      return callback(err);
    }

    i++;

    if (i >= plugins.length) {
      return callback();
    }

    plugins[i].apply(_this, args);
  })

  args.push(next);

  plugins[0].apply(this, args);
};

/**
 * 发布事件 - 以异步方式,依次执行事件处理函数.调用每个事件处理执行完成之后,调用next函数执行下一个事件处理函数.如果发生错误或所有事件处理函数都执行了,才停止执行
 * 
 * sync/async : async
 * 
 * @param {String} name 事件名称
 * @param {Any} param 调用事件处理函数的参数
 * @param {Function} callback 回调函数
 */
Tapable.prototype.applyPluginsAsyncSeries1 = function applyPluginsAsyncSeries1(name, param, callback) {
  var plugins = this._plugins[name];
  if (!plugins || plugins.length === 0) return callback();
  var i = 0;
  var _this = this;
  var innerCallback = copyProperties(callback, function next(err) {
    if (err) return callback(err);
    i++;
    if (i >= plugins.length) {
      return callback();
    }
    plugins[i].call(_this, param, innerCallback);
  });
  plugins[0].call(this, param, innerCallback);
};

/**
 * 发布事件 - 以异步方式,依次执行事件处理函数.
 * 当某个事件处理函数通过next函数传递返回值时,则停止调用后续的事件处理函数,并将该返回值作为callback的参数
 * 
 * sync/async : async
 * 
 * @param {String} name 事件名称
 * @param {...Any} args [arg0 , arg1 , ... , callback] 调用事件处理函数的参数 , 以及回调函数
 */
Tapable.prototype.applyPluginsAsyncSeriesBailResult = function applyPluginsAsyncSeriesBailResult(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  var callback = args.pop();

  if (!this._plugins[name] || this._plugins[name].length === 0) {
    return callback();
  }

  var plugins = this._plugins[name];
  var i = 0;
  var _this = this;

  args.push(copyProperties(callback, function next() {
    // 有参数返回 , 调用回调函数
    if (arguments.length > 0) {
      return callback.apply(null, arguments);
    }

    i++;

    // 执行结束 , 触发回调函数
    if (i >= plugins.length) {
      return callback();
    }

    plugins[i].apply(_this, args);
  }));

  plugins[0].apply(this, args);
};

/**
 * 发布事件 - 以异步方式,依次执行事件处理函数.
 * 当某个事件处理函数通过next函数传递返回值时,则停止调用后续的事件处理函数,并将该返回值作为callback的参数
 * 
 * sync/async : async
 * 
 * @param {String} name 事件名称
 * @param {Any} param 调用事件处理函数的参数
 * @param {Function} callback 回调函数
 */
Tapable.prototype.applyPluginsAsyncSeriesBailResult1 = function applyPluginsAsyncSeriesBailResult1(name, param, callback) {
  var plugins = this._plugins[name];
  if (!plugins || plugins.length === 0) return callback();
  var i = 0;
  var _this = this;
  var innerCallback = copyProperties(callback, function next(err, result) {
    if (arguments.length > 0) return callback(err, result);
    i++;
    if (i >= plugins.length) {
      return callback();
    }
    plugins[i].call(_this, param, innerCallback);
  });
  plugins[0].call(this, param, innerCallback);
};



/**
 * 发布事件 - 以一步方式 , 按waterfall方式依次执行事件处理函数
 * 
 * sync/async : async
 * 
 * @param {String} name 事件名称
 * @param {Any} init 初始值
 * @param {Function} callback 回调函数
 */
Tapable.prototype.applyPluginsAsyncWaterfall = function applyPluginsAsyncWaterfall(name, init, callback) {
  if (!this._plugins[name] || this._plugins[name].length === 0) {
    return callback(null, init);
  }

  var plugins = this._plugins[name];
  var i = 0;
  var _this = this;

  var next = copyProperties(callback, function (err, value) {
    if (err) return callback(err);
    i++;

    if (i >= plugins.length) {
      return callback(null, value);
    }

    plugins[i].call(_this, value, next);
  });

  plugins[0].call(this, init, next);
};



/**
 * 发布事件 - 以异步方式 , 并行执行所有的事件处理函数 , 当所有事件执行函数或某个事件执行错误时调用callback,结束执行
 * @param {String} name 事件名称
 * @param {...Any} ...args [arg0 , arg1 , ... , callback] 调用事件处理函数的参数 , 以及回调函数
 */
Tapable.prototype.applyPluginsParallel = function applyPluginsParallel(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  var callback = args.pop();

  if (!this._plugins[name] || this._plugins[name].length === 0) {
    return callback();
  }

  var plugins = this._plugins[name];
  var remaining = plugins.length;

  args.push(copyProperties(callback, function (err) {
    if (remaining < 0)
      return; // ignore

    if (err) {
      remaining = -1;
      return callback(err);
    }

    remaining--;

    if (remaining === 0) {
      return callback();
    }
  }));

  for (var i = 0; i < plugins.length; i++) {
    plugins[i].apply(this, args);
    
    if (remaining < 0) {
      return;
    }
  }
};

/**
 * 发布事件 - 以异步方式 , 并行执行所有的事件处理函数
 * 
 * 1. 保证所有的事件处理函数都执行完毕之后 , 再执行callback
 * 2. 当有事件处理函数返回值时,触发callback()
 * 3. 当有多个事件处理函数返回值时,按注册顺序,将最先注册的事件触发器的返回值作为callback的返回值
 *  
 * 
 * @param {String} name 事件名称
 * @param {...Any} ...args [arg0 , arg1 , ... , callback] 调用事件处理函数的参数 , 以及回调函数
 */
Tapable.prototype.applyPluginsParallelBailResult = function applyPluginsParallelBailResult(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  var callback = args[args.length - 1];

  if (!this._plugins[name] || this._plugins[name].length === 0) {
    return callback();
  }

  var plugins = this._plugins[name];

  // 记录有参数返回的fn在队列中的位置 
  var currentPos = plugins.length;

  // 记录执行结果
  var currentResult;

  // 记录已经执行完毕的fn
  var done = [];

  for (var i = 0; i < plugins.length; i++) {
    args[args.length - 1] = (function (i) {
      return copyProperties(callback, function () {
        //
        // 处理回调函数
        //
        // console.log(currentPos)

        // 
        // 如果当前完成的fn在currentPos之后注册 , 那么它就没有资格触发callback
        //
        if (i >= currentPos) {
          return; // ignore
        }

        // 添加到完成列表
        done.push(i);

        // 有参数返回
        if (arguments.length > 0) {
          // i + 1 , 表示只允许在它之前注册的fn触发callback
          currentPos = i + 1;

          // 过滤done中 , 在fn之后注册的fn
          done = fastFilter.call(done, function (item) {
            return item <= i;
          });

          // 记录结果
          currentResult = Array.prototype.slice.call(arguments);
        }

        // 当fn之前注册的所有fn都执行完毕之后 , 触发callback
        if (done.length === currentPos) {
          callback.apply(null, currentResult);
          currentPos = 0;
        }
      });
    }(i));

    plugins[i].apply(this, args);
  }
};

/**
 * 发布事件 - 以异步方式 , 并行执行所有的事件处理函数
 * 
 * 1. 保证所有的事件处理函数都执行完毕之后 , 再执行callback
 * 2. 当有事件处理函数返回值时,触发callback()
 * 3. 当有多个事件处理函数返回值时,按注册顺序,将最先注册的事件触发器的返回值作为callback的返回值
 *  
 * 
 * @param {String} name 事件名称
 * @param {Any} param 调用事件处理函数的参数
 * @param {Function} callback 回调函数
 */
Tapable.prototype.applyPluginsParallelBailResult1 = function applyPluginsParallelBailResult1(name, param, callback) {
  var plugins = this._plugins[name];
  if (!plugins || plugins.length === 0) return callback();
  var currentPos = plugins.length;
  var currentResult;
  var done = [];
  for (var i = 0; i < plugins.length; i++) {
    var innerCallback = (function (i) {
      return copyProperties(callback, function () {
        if (i >= currentPos) return; // ignore
        done.push(i);
        if (arguments.length > 0) {
          currentPos = i + 1;
          done = fastFilter.call(done, function (item) {
            return item <= i;
          });
          currentResult = Array.prototype.slice.call(arguments);
        }
        if (done.length === currentPos) {
          callback.apply(null, currentResult);
          currentPos = 0;
        }
      });
    }(i));
    plugins[i].call(this, param, innerCallback);
  }
};


/**
 * 订阅事件 ( 实现的功能类似 addEventListener )
 * 
 * @param {string|string[]} name 订阅的一个或多个事件名称
 * @param {Function} fn 事件处理函数
 */
Tapable.prototype.plugin = function plugin(name, fn) {
  if (Array.isArray(name)) {
    name.forEach(function (name) {
      this.plugin(name, fn);
    }, this);
    return;
  }

  if (!this._plugins[name]) this._plugins[name] = [fn];
  else this._plugins[name].push(fn);
};

/**
 * 注册插件
 * @param {...Any} args 一个或多个插件
 */
Tapable.prototype.apply = function apply() {
  for (var i = 0; i < arguments.length; i++) {
    arguments[i].apply(this);
  }
};
