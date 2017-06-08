# HOT MODULE REPLACEMENT

“Hot Module Replacement” (HMR) is a feature to inject updated modules into the active runtime.

> It’s like LiveReload for every module.

_"热模块替换" (HMR) 是一个将更新的模块注入活动运行时的特性._

> 它就像为每个系统实现了LiveReload

HMR is “opt-in”, so you need to put some code at chosen points of your application. The dependencies are handled by the module system.

_HMR是可选的,所以你需要在你的应用把一些代码.通过模块系统处理依赖关系_

I. e. you place your hot replacement code in module A. Module A requires module B and B requires C. If module C is updated, and module B cannot handle the update, modules B and C become outdated. Module A can handle the update and new modules B and C are injected.

_例如,你将热替换代码放在A中.模块A会请求模块B,模块B会请求模块C._
* _模块C被更新,模块B不能处理更新,模块B和C都会变成过期的._
* _模块A能处理更新,因此将新的模块B和C注入到活动运行时._

## Examples

### Example 1: hot replace request handler of http server ( HTTP 服务器的热替换请求处理器 )

```javascript

var requestHandler = require("./handler.js");
var server = require("http").createServer();

server.on("request", requestHandler);
server.listen(8080);

// check if HMR is enabled ( 检查热替换是否启用 )
if(module.hot) {
    // accept update of dependency ( 依赖 -- 接收更新 )
    // 当./handler.js发生变更 , 收到"Update"时触发绑定的函数
    module.hot.accept("./handler.js", function() {

        // replace request handler of server ( 替换服务器的请求处理器 )
        server.removeListener("request", requestHandler);
        requestHandler = require("./handler.js");
        server.on("request", requestHandler);
    });
}

```
### Example 2:hot replace css ( 热替换CSS )

```javascript

// addStyleTag(css: string) => HTMLStyleElement
var addStyleTag = require("./addStyleTag");

var element = addStyleTag(".rule { attr: name }");
module.exports = null;

// check if HMR is enabled
if(module.hot) {

    // accept itself
    module.hot.accept();

    // removeStyleTag(element: HTMLStyleElement) => void
    var removeStyleTag = require("./removeStyleTag");

    // dispose handler
    module.hot.dispose(function() {
        // revoke the side effect
        removeStyleTag(element);
    });
}

```


### Example 3: Hot module replace with require.context ( 关于require.context的代替热模块 )

```javascript

var context = require.context("./filesToLoad", false, /\.js$/); //filesToLoad is a directory with .js files
var modules = {};
context.keys().forEach(function (key) {
  var module = context(key);
  modules[key] = module;
  customReloadLogic(key, module, false);
})

if (module.hot) {
  module.hot.accept(context.id, function () {
    //You can't use context here. You _need_ to call require.context again to
    //get the new version. Otherwise you might get errors about using disposed
    //modules
    var reloadedContext = require.context("./filesToLoad", false, /\.js$/);
    //To find out what module was changed you just compare the result of the
    //require call with the version stored in the modules hash using strict
    //equality. Equal means it is unchanged.
    var changedModules = reloadedContext.keys()
      .map(function (key) {
        return [key, reloadedContext(key)];
      })
      .filter(function (reloadedModule) {
        return modules[reloadedModule[0]] !== reloadedModule[1];
      });
    changedModules.forEach(function (module) {
      modules[module[0]] = module[1];
      customReloadLogic(module[0], module[1], true);
    });
  });
}

function customReloadLogic(name, module, isReload) {
  console.log("module " + name + (isReload ? " re" : " ") + "loaded");
}

```

## API

If HMR is enabled for a module **module.hot** is an object containing these properties:

_如果HMR是启用,那么一个模块的**module.hot**是一个包含这些属性的对象:_

### accept

```javascript

accept(dependencies: string[], callback: (updatedDependencies) => void) => void
accept(dependency: string, callback: () => void) => void

```

Accept code updates for the specified dependencies. The callback is called when dependencies were replaced.

_设置当前模块接收指定的依赖项的代码更新.当依赖项被替换时,回调函数被调用._

```javascript

accept([errHandler]) => void

```

Accept code updates for this module without notification of parents. This should only be used if the module doesn’t export anything. The errHandler can be used to handle errors that occur while loading the updated module.

_该方法签名只接收模块的代码更新,而不通知父级.只有在模块不导出任何内容时,才应该使用此方法签名.errHandler可以用来处理加载更新模块的过程中出现的错误._

### decline

```javascript

decline(dependencies: string[]) => void
decline(dependency: string) => void

```

Do not accept updates for the specified dependencies. If any dependencies is updated, the code update fails with code "decline".

_设置当前模块不接收指定依赖项的更新.如果任意指定的依赖更新,更新代码操作将失败,代码为"decline"_

```javascript

decline() => void

```

Flag the current module as not update-able. If updated the update code would fail with code "decline".

_将当前模块标记未不可更新.如果更新,更新代码操作将失败,代码为"decline"_

### dispose/addDisposeHandler

```javascript

dispose(callback: (data: object) => void) => void
addDisposeHandler(callback: (data: object) => void) => void

```

Add a one time handler, which is executed when the current module code is replaced. Here you should destroy/remove any persistent resource you have claimed/created. If you want to transfer state to the new module, add it to **data** object. The data will be available at module.hot.data on the new module.

_添加一个一次性处理器,当前模块代码被替换时执行.在此处,你应该destroy/remove你声明/创建的任意持久资源(setTimeout...).如果你想将状态传输到新的模块,请将其添加到**data**对象.**data** 对象在新模块的**module.hot.data**处可用_

### removeDisposeHandler

```javascript

removeDisposeHandler(callback: (data: object) => void) => void

```

Remove a handler.

_移除一个处理器_

This can useful to add a temporary dispose handler. You could i. e. replace code while in the middle of a multi-step async function.

_可以用于添加临时的dispose处理器.例如,你能在多步骤异步函数的中间替换代码._


## Management API

Also on the module.hot object.

### check

### apply

### status

### status/addStatusHandler

### removeStatusHandler



__

## Hot to deal with ...
