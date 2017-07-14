require('./4')
require('./5')

require.ensure([],function(){
  require('./1')
  require('./4')
  require('./7')
},'A')

require.ensure([],function(){
  require('./2')
  require('./6')
},'B')