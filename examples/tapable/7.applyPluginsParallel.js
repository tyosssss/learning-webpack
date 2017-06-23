const { Tapable } = require('../common')
const tapable = new Tapable
const fn = (function () {
  let empty = true

  return (any, delay, err) => callback => {
    setTimeout(function () {
      console.log(' '.repeat(delay / 100) + (empty ? '' : ' -> ') + any)
      empty = false

      callback(err)
    }, delay)
  }
})()

// applyPlugins
tapable.plugin('event', fn('a', 100))
tapable.plugin('event', fn('b', 500))
tapable.plugin('event', fn('c', 200))
tapable.plugin('event', fn('d', 500))
tapable.plugin('event', fn('e', 50))

tapable.applyPluginsParallel('event', function done(err, result) {
  console.log('')

  if (err) {
    console.log('error', err)
  }

  console.log('ok', result)
})