const { Tapable } = require('../common')
const tapable = new Tapable
const fn = (function () {
  let empty = true

  return (any, fn) => (current, offset) => {
    process.stdout.write((empty ? '' : ' -> ') + fn.toString().replace(/a/g, current))

    empty = false

    return fn(current)
  }
})()

// applyPlugins
tapable.plugin('event', fn('a', a => a + a))
tapable.plugin('event', fn('b', a => a * 2))
tapable.plugin('event', fn('c', a => a * a))

console.log('\r\nresult : ' + tapable.applyPluginsWaterfall('event', 1))