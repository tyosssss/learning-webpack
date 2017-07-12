require('./1')
require('./2')
require('./3')

require.ensure([],function(){
  require('./4')
  require('./5')
},'F')

require.ensure([],function(){
  require('./5')
},'G')