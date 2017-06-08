module.exports = function (resource){
  // console.log('second loader')
  // console.log('request' , this.request)
  // return resource

  console.log('normal second loader')
  console.log(this.resource)

  return resource
}

module.exports.pitch = function(remainingRequest , precedingRequest , data){
  console.log('second loader')
  console.log(this.resource)
  
  console.log(remainingRequest)
  console.log(precedingRequest)
  console.log(data)
}