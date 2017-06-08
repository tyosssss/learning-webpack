let common1 = require('./common1')
let common2 = require('./common2')

module.exports = function () {
  require.ensure(['./jquery'], function (jquery) {
    var jq = require('./jquery')

    console.log(jq)
    console.log(jquery)
    console.log('b')
  })
}
