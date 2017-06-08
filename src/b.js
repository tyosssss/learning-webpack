// var jquery = require('./jquery')
var common1 = require('./common1')
var common2 = require('./common2')

module.exports = function () {
  // console.log('ba')
  require.ensure([],function(){
    require('./a')
  })
}
