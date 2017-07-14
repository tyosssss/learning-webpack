require('./4')
require('./5')
require('./67')

require.ensure([],function(){
  require('./1')
  require('./4')
  require('./7')
},'A')

require.ensure([],function(){
  require('./3')
},'B')