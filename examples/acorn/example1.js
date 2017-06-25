const source = `
  // export default 42;
  // export var foo = 1;
  // export {foo as default, bar}
  // export {foo as default, bar} from '../1'

  // import {firstName as cc, lastName, year} from './profile';
  // import aa from './profile';
  // import * as local from '/profile'

  // var [a,b,...c] = [1,2,3,4]
  var {a ,b : dd , d = 1 + 2,  c : { d }} = {}
  // function a(f=1){}

  // a = a +1


  var b1 = a['a']
  var b3 = (a,b)=>void 666;
  ;
  var b2 = i++;
  b2 += 5
  var [a,b] = [1,2,3];
  var {a,b} = {a:1,b:2}
  var c = [1,2,3];
  var d = {a:1,b:2};
  var e = function(){};
  var f = null;
  var g = undefined;
  var h = true;
  var i = false;

  function fn(a,b,c){
    var a = 1;
    var b = 2;

    return 5;
  }
`

const acorn = require('acorn')
// const source = `
//   var a = 1;
//   let b = "2";
//   const c = undefined;

//   var fn1 = ()=>void 666;
//   var fn2 = ()=>void 666;

//   function fn3(a,b){
//     return a + b;
//   }
  
//   c(a,b);

//   this.c(a,b);
// `



ast = acorn.parse(source, {
  ranges: false,
  locations: false,
  ecmaVersion: 2017,
  sourceType: "module"
});

console.log(JSON.stringify(ast, null, 2))