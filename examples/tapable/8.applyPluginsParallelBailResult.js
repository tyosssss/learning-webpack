const { Tapable } = require('../common')
const tapable = new Tapable
const fn = (function () {
  let empty = true

  return (any, delay, bail) => (callback) => {
    setTimeout(() => {
      console.log(' '.repeat(delay / 100) + (empty ? '' : ' -> ') + 'next -- ' + any)
      empty = false

      if (bail) {
        callback(null, 'bail ' + any)
      } else {
        callback()
      }
    }, delay)
  }
})()

// applyPlugins

// 1. 所有的fn都被执行
// tapable.plugin('event', fn('a', 1))
// tapable.plugin('event', fn('b', 2))
// tapable.plugin('event', fn('c', 3))
// tapable.plugin('event', fn('d', 100, true))
// tapable.plugin('event', fn('f', 200))
// tapable.plugin('event', fn('e', 100))

// tapable.plugin('event', fn('a', 1))
// tapable.plugin('event', fn('b', 2))
// tapable.plugin('event', fn('c', 3))
// tapable.plugin('event', fn('d', 100))
// tapable.plugin('event', fn('f', 200))
// tapable.plugin('event', fn('e', 100))

// 2. callback只会被执行一次  -- 如果有多个返回值 , 按注册顺序,将最先注册的fn的返回值作为callback的返回值
// bail a ( a覆盖d的结果 )
// tapable.plugin('event', fn('a', 200, true))
// tapable.plugin('event', fn('b', 2))
// tapable.plugin('event', fn('c', 500))
// tapable.plugin('event', fn('d', 100, true))
// tapable.plugin('event', fn('f', 200))
// tapable.plugin('event', fn('e', 100))

// 3. 当在有返回值的fn之前注册的fn都执行之后 , 才会触发callback
// bail d ( d在c之后注册 , 所以要等到c执行完成之后 , 才会触发回调函数 )
tapable.plugin('event', fn('a', 1))
tapable.plugin('event', fn('b', 2))
tapable.plugin('event', fn('c', 500))
tapable.plugin('event', fn('d', 100, true))
tapable.plugin('event', fn('f', 200))
tapable.plugin('event', fn('e', 100))

// bail e
// tapable.plugin('event', fn('a', 100))
// tapable.plugin('event', fn('b', 200))
// tapable.plugin('event', fn('c', 500))
// tapable.plugin('event', fn('d', 100))
// tapable.plugin('event', fn('f', 200))
// tapable.plugin('event', fn('e', 1,true))

tapable.applyPluginsParallelBailResult('event', function done(err, result) {
  if (err) {
    console.log('error', err)
  }

  console.log('ok', result)
})