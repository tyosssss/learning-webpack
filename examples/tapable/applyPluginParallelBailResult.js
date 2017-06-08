const Tapable = require('tapable')
const tapable = new Tapable()

function Plugin() {

}

Plugin.prototype.apply = function (tapable) {
  tapable.plugin('emit', function (a, b, cb) {
    setTimeout(() => {
      console.log('2', a, b);
      cb();
    }, 1);
  })

  tapable.plugin('emit', function (a, b, cb) {
    setTimeout(() => {
      console.log('1', a, b);
      cb();
    }, 1000);
  })

  tapable.plugin('emit', function (a, b, cb) {
    setTimeout(() => {
      console.log('3', a, b);
      cb();
    }, 5);
  })
}

tapable.apply(new Plugin())

tapable.applyPluginsParallelBailResult('emit', 'a', 'b', function (a, b) {
  console.log('end', a, b)
})