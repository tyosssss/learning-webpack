const { Tapable } = require('../common')
const tapable = new Tapable
const fn = (function () {
  let empty = true

  return (any, delay, bail) => (callback) => {
    setTimeout(() => {
      console.log(' '.repeat(delay / 100) + (empty ? '' : ' -> ') + 'callback -- ' + any)
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

// bail d 在f之前
// tapable.plugin('event', fn('a', 1))
// tapable.plugin('event', fn('b', 2))
// tapable.plugin('event', fn('c', 3))
// tapable.plugin('event', fn('d', 100, true))
// tapable.plugin('event', fn('f', 200))
// tapable.plugin('event', fn('e', 100))

// bail d 在f之后
// tapable.plugin('event', fn('a', 1))
// tapable.plugin('event', fn('b', 2))
// tapable.plugin('event', fn('c', 500))
// tapable.plugin('event', fn('d', 100, true))
// tapable.plugin('event', fn('f', 200))
// tapable.plugin('event', fn('e', 100))

// bail a | a覆盖d的结果
// tapable.plugin('event', fn('a', 1, true))
// tapable.plugin('event', fn('b', 2))
// tapable.plugin('event', fn('c', 500))
// tapable.plugin('event', fn('d', 100, true))
// tapable.plugin('event', fn('f', 200))
// tapable.plugin('event', fn('e', 100))

// bail e
tapable.plugin('event', fn('a', 100))
tapable.plugin('event', fn('b', 200))
tapable.plugin('event', fn('c', 500))
tapable.plugin('event', fn('d', 100))
tapable.plugin('event', fn('f', 200))
tapable.plugin('event', fn('e', 1,true))

tapable.applyPluginsParallelBailResult('event', function done(err, result) {
  if (err) {
    console.log('error', err)
  }

  console.log('ok', result)
})