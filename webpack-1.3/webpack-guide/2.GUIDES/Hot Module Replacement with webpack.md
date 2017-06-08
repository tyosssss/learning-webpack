# HOT MODULE REPLACEMENT WITH WEBPACK ( webpack 与 热模块替换 )

Note that Hot Module Replacement (HMR) is still an experimental feature.

_请注意 : 热模块替换(HMR)仍然仅仅是一个是心啊行特性._


## INTRODUCTION ( 介绍 )

Hot Module Replacement (HMR) exchanges, adds, or removes modules while an application is running without a page reload.

_热模块替换(HMR)可以在做到,当 **应用程序正在运行并且不刷新页面的情况下,交换,添加或者删除模块.**_

## Prerequirements ( 前提条件 )

* [Using Plugins](http://webpack.github.io/docs/using-plugins.html)
* [Code Splitting](http://webpack.github.io/docs/code-splitting.html)
* [webpack-dev-server]( http://webpack.github.io/docs/webpack-dev-server.html)


## How does it work? ( HRM 是如何工作的 ? )

Webpacks adds a small HMR runtime to the bundle, during the build process, that runs inside your app. When the build completes, Webpack does not exit but stays active, watching the source files for changes. If Webpack detects a source file change, it rebuilds only the changed module(s). Depending on the settings, Webpack will either send a signal to the HMR runtime, or the HMR runtime will poll webpack for changes. Either way, the changed module is sent to the HMR runtime which then tries to apply the hot update. First it checks whether the updated module can self-accept. If not, it checks those modules that have required the updated module. If these too do not accept the update, it bubbles up another level, to the modules that required the modules that required the changed module. This bubbling-up will continue until either the update is accepted, or the app entry point is reached, in which case the hot update fails.

_Webpack在构建过程中,向运行的应用程序的包里面添加一个很小的HRM runtime.当构建完成时,Webpack不会退出,而是保持活动状态,以便监视源文件的变化.如果webpack发现源文件有变化,那么它仅会重新构建变化了的模块.根据设置,webpack要么向HMR运行是发送一个信号,要么HRM runtime轮询webpack发生变更.不管怎么样,变更的模块都将发送到HRM runtime,然后尝试应用热更新.首先,HRM runtime会检查被更新的模块是否能自行接收更新.如果不能,HRM runtime会继检查那些有请求被更新的模块的模块.如果这些模块也不接收更新,那么HRM runtime会冒泡到另一个级别,to the modules that required the modules that required the changed module.这冒泡将继续,直到更新被接收或者达到应用程序入口,通常这种情况,被看做热更新失败._

### From the app view ( 从应用程序视图看 )

The app code asks the HMR runtime to check for updates. The HMR runtime downloads the updates (async) and tells the app code that an update is available. The app code asks the HMR runtime to apply updates. The HMR runtime applies the update (sync). The app code may or may not require user interaction in this process (you decide).

_1. 应用程序代码要求HRM runtime检查更新.HRM runtime下载更新(异步)并告知应用程序代码更新是可用的._

_2. 应用程序代码要求HRM runtime应用更新._

_3. HRM runtime应用更新(同步)_

_4. 在此过程中 , 应用程序代码可能需要或也可能不需要与用户交互(这取决于你)_


### From the compiler (webpack) view  ( 从编译器视图看 )

In addition to the normal assets, the compiler needs to emit the “Update” to allow updating the previous version to the current version. The “Update” contains two parts:

_除了正常的assets,编译器需要发送一个"Update",以便允许将以前的版本更新为当前版本."Update"包含两个部分:_

1. the update manifest (json)
2. one or multiple update chunks (js)


_1. 更新清单(json)_
_2. 一个或多个更新块(js)_

The manifest contains the new compilation hash and a list of all update chunks (2.).

_清单包含新的编译hash和所有更新块的列表._

The update chunks contains code for all updated modules in this chunk (or a flag if a module was removed).

_更新块包含此块中所有已更新模块的代码.( 或者 如果模块已被删除,则设一个标志 )_

The compiler also makes sure that module and chunk ids are consistent between these builds. It uses a “records” json file to store them between builds (or it stores them in memory).

_编译器还会确保模块和块的ID在这些构建之间保持一致.编辑器使用"records"json文件存储构建之间的Id.(或者使将其存储在内存中)_

### From the module view ( 从模块视图看 )

HMR is an opt-in feature, so it only affects modules that contain HMR code. The documentation describes the API that is available in modules. In general, the module developer writes handlers that are called when a dependency of this module is updated. They can also write a handler that is called when this module is updated.

_HMR是可选性功能,因此它只影响包含HMR代码的模块.文档描述了模块中可用的API.通常,模块开发者编写在更新模块依赖关系时被调用的处理器.他们还可以写更新模块时调用的处理器._

In most cases it’s not mandatory to write HMR code in every module. If a module has no HMR handlers the update bubbles up. This means a single handler can handle an update to a complete module tree. If a single module in this tree is updated, the complete module tree is reloaded (only reloaded not transferred).

_大多数情况下,并不强制要求在每个模块都编写HMR代码.如果一个模块没有HRM处理器,那么更新就会被冒泡.这意味着单个处理器能处理整个模块树的更新.如果这棵树中的一个简单模块被更新,整颗模块树都会被重新加载 ( 仅重新加载,并不传输  )_


## From the HMR runtime view (technical)  ( 从HRM runtime 视图看 )

For the module system runtime is additional code emitted to track module parents and children.

_模块系统运行时是emitted to跟踪父模块和子模块的附加代码._

On the management side the runtime supports two methods: check and apply.

_在管理方面,这个运行时支持两种方法:check和apply._

A check does an HTTP request to the update manifest. When this request fails, there is no update available. Otherwise the list of updated chunks is compared to the list of currently loaded chunks. For each loaded chunk the corresponding update chunk is downloaded. All module updates are stored in the runtime as update. The runtime switches into the ready state, meaning an update has been downloaded and is ready to be applied.

_check - 向更新清单发出HTTP请求.当请求失败时,表示不存在有效的更新.否则,将更新模块的清单当前加载的块进行比较.为每个加载块,下载相应的更新块.所有模块更新都作为更新存储在运行时中.运行时会切换到就绪状态,这意味着一个更新已经加载完毕并准备应用它._

For each new chunk request in the ready state the update chunk is also downloaded.

_对于处于就绪状态的每个新块请求the update chunk is also downloaded._

The apply method flags all updated modules as invalid. For each invalid module there needs to be a update handler in the module or update handlers in every parent. Else the invalid module bundles up and marks all parents as invalid too. This process continues until no more “bubbling up” occurs. If it bubbles up from an entry point the process fails.

_apply方法将所有被更新的模块标记为无效的.对于每个无效的模块,需要在模块中有一个更新处理器或是在其父级中有一个更新处理器.否则无效模块将冒泡,并将所有父级也标记为无效的.该过程将一直继续下去,直到不在发生"冒泡".如果它从入口点冒泡,则更新过程失败._

Now all invalid modules are disposed (dispose handler) and unloaded. Then the current hash is updated and all “accept” handlers are called. The runtime switches back to the idle state and everything continues as normal.

_现在所有无效的模块都被处理(dispose handler)和卸载.然后,更新当前hash并调用所有的"accept"处理器.运行时切换回空闲状态,一切归为平静._

## Generated files (technical) ( 生成的文件 )

The left side represents the initial compiler pass. The right side represents an additional pass with module 4 and 9 updated.

_左边表示初始编译器.右边表示附加一个更新( 模块4和模块9 )_

![img](http://webpack.github.io/assets/HMR.svg)

## What can I do with it? ( 我能用它做什么 ? )

You can use it in development as a replacement for LiveReload. Actually the webpack-dev-server supports a hot mode which tries to update with HMR before trying to reload the whole page. You only need to add the **webpack/hot/dev-server** entry point and call the dev-server with **--hot**.

_你可以在开发中使用它来代替LiveReload.实际上,webpack-dev-server支持一种试图重新加载整个页面之前,尝试使用HRM取更新的热模式.你仅需添加一个**webpack/hot/dev-server**入口点,并使用**--hot**调用dev-server._

**webpack/hot/dev-server** will reload the entire page if the HMR update fails. If you want to [reload the page on your own](https://github.com/webpack/webpack/issues/418), you can add **webpack/hot/only-dev-server** to the entry point instead.

_如果HMR更新失败, **webpack/hot/dev-server** 将会重新加载整个页面.如果你想要自己重新加载页面,你可以将添加 **webpack/hot/only-dev-server**来代替入口点._

You can also use it in production as an updating mechanism. Here you would need to write your own management code that integrates HMR with your app.

_你也可以在生产中将其作为更新机制.在这里,你需要编写将HRM与你的应用程序集成的管理代码._

Some loaders already generate modules that are hot-updateable (e.g. the style-loader can exchange a stylesheet). In these cases, you don’t need to do anything special.

_一些加载器已经可以生成可热替换的模块(样式加载器 -- 可以交换样式表).在这些情况下,你无需做任何其他操作._

## What is needed to use it? ( 需要使用什么 ? )

A module can only be updated if you “accept” it. So you need to **module.hot.accept** the module in the parents or the parents of the parents. For example, a router or a subview would be a good place.

_模块只能在你"接收"的情况下更新.所以,你需要在模块的父级或祖先上设置**module.hot.accept**.例如,路由或子视图会是一个比较好的地方._

If you only want to use it with the webpack-dev-server, just add **webpack/hot/dev-server** as entry point. Else you need some HMR management code that calls check and apply.

_如果你只想将它与webpack-dev-server一起使用,那么仅需添加**webpack/hot/dev-server**作为入口点即可.否则你需要调用check或apply的HRM管理代码._

You need to enable records in the Compiler to track module id between processes. (watch mode and the webpack-dev-server keep records in memory, so you don’t need it for development)

_你需要在编译器中启用记录以便跟踪进程之间的模块ID.(watch模式和webpack-dev-server讲记录保存在内存中,所以你无需进行额外开发.)_

You need to enable HMR in the Compiler to let it add the HMR runtime.

_你需要在编辑器中弃用HMR,以及添加HRMruntime._

### What makes it so cool? ( 是什么让它如此之酷 ? )

* It’s like LiveReload but for every module, so to speak.
* You can use it in production.
* The updates respect your Code Splitting and only download updates for the changed parts of your app.
* You can use it for parts of your application and it doesn’t affect other modules.
* If HMR is disabled all HMR code is removed by the compiler (wrap it in if(module.hot))


* _它像LiveReload_
* _你能在生产环境使用它._
* _更新与代码拆分有关,它仅加载应用程序变更的那一部分更新._
* _你能将其应用于你的应用程序的某一部分,并且不会影响其他模块._
* _如果HRM被禁用,则编译器将删除所有的HMR代码._


### Caveats ( 警告 )

* It’s experimental and not tested thoroughly.
* Expect some bugs
* Theoretically usable in production, but it maybe too early to use it for something serious
* The module ids need to be tracked between compilations so you need to store them (records)
* Optimizer cannot optimize module ids anymore after the first compilation. Therefore the bundle size is affected a little bit.
* HMR runtime code increases bundle size.
* For production usage additional testing is required to test the HMR handlers. This could be pretty difficult.


* _它是实验性的,没有彻底测试._
* _其他一些Bug_
* _理论上可以用于生成,但是将它应于某些重要的程序是为时过早的._
* _模块ID需要在编译之间进行跟踪,因此你需要存储它们._
* _优化器在首次编译之后,将不能再优化模块ID.因此,包尺寸大小将受到一点影响._
* _HRM runtime代码增加包的尺寸_
* _对于生产使用,需要额外的测试来测试HMR处理器.这可能很困难._


## TUTORIAL

To use hot code replacement with webpack you need four things:

_要使用webpack的热替换,你需要做四件事情:_

* records (--records-path, recordsPath: ...)
* globally enable hot code replacement (HotModuleReplacementPlugin)
* hot replacement code in your code **module.hot.accept**
* hot replacement management code in your code **module.hot.check**, **module.hot.apply**

* _记录 (--records-path, recordsPath: ...)_
* _全局启用热代码替换(HotModuleReplacementPlugin)_
* _在你的代码中包含热替换代码(**module.hot.accept**)_
* _在你的代码中包含热替换的管理代码(**module.hot.check**, **module.hot.apply**)_

A small testcase:

_一个小的测试用例:_

```css
/* style.css */
body {
    background: red;
}
```

```javascript
/* entry.js */
require("./style.css");
document.write("<input type='text' />");

```

That’s enough to use hot code replacement with the dev-server.

_这足以在dev-server中使用热代码替换._

```shell

npm install webpack webpack-dev-server -g
npm install webpack css-loader style-loader
webpack-dev-server ./entry --hot --inline --module-bind "css=style\!css"

```

The dev server provides in memory records, which is good for development.

_dev服务器在内存中记录,这对开发有好处._

The --hot switch enables hot code replacement.

_--hot开关启用热替换代码._

This adds the **HotModuleReplacementPlugin**. Make sure to use either the --hot flag, or the **HotModuleReplacementPlugin** in your webpack.config.js, but never both at the same time as in that case, the HMR plugin will actually be added twice, breaking the setup.

_这将添加**HotModuleReplacementPlugin**.确保要么使用--hot,或者在webpack.config.js中添加**HotModuleReplacementPlugin**,但是不要同时使用,否则HMR插件实际上会被添加两次._

There is special management code for the dev-server at **webpack/hot/dev-server**, which is automatically added by **--inline.** (You don’t have to add it to your webpack.config.js)

_(你不必将它添加到你的webpack.config.js中)_

The style-loader already includes hot replacement code.

_style-loader已经包含热替换的代码._

If you visit http://localhost:8080/bundle you should see the page with a red background and a input box. Type some text into the input box and edit **style.css** to have another background color.

_如果你访问http://localhost:8080/bundle ,你应该能看到红色背景和一个输入框.在输入框输入一些文本,然后编辑"style.css"以获得另一种背景颜色._

The background updates but without full page refresh. Text and selection in the input box should stay.

_后台更新了,但是没有刷新整个页面.文本和选中状态仍然呆在输入框中._

Read more about how to write you own hot replacement (management) code: [hot module replacement](http://webpack.github.io/docs/hot-module-replacement.html)

_阅读更多关于如何编写自己的热替换(管理)代码:[hot module replacement](http://webpack.github.io/docs/hot-module-replacement.html)_

Check the [example-app](http://webpack.github.io/example-app/) for a demo without coding. (Note: It’s a bit old, so don’t look at the source code, because the HMR API changed a bit in between)
