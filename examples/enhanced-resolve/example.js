const { Resolver } = require('../common').enhancedResolver

class Plugin {
  constructor(source, name, target) {
    this.source = source
    this.target = target
    this.name = name
  }

  apply(resolver) {
    let { name, source, target } = this

    resolver.plugin(source, function (result, callback) {
      console.log(name)

      result[name] = 1

      resolver.doResolve(
        target,
        result,
        'doResolve ' + name,
        function () {
          console.log('plugin ' + target + ' callback')

          if (target === 'b') {
            callback(null, result)
          } else {
            callback()
          }
        }
      )
    })
  }
}

class Plugin1 extends Plugin {
  constructor(source, target) {
    super(source, target)
  }

  apply() {

  }
}

const resolver = new Resolver

/**
 * before-resove --> resolve --> before-b --> b --> before-c --> c --> before->d --> d ---------------------
 *                                                                                                         |
 *                                                                                                         |
 * completed <-- after-resolve <-- callback b <-- after-b <-- callback c <-- after-c <-- callback d <--  after-d
 */

resolver.apply(new Plugin('resolve', 'plugin 1', 'b'))
resolver.apply(new Plugin('b', 'plugin 2', 'c'))
resolver.apply(new Plugin('c', 'plugin 3', 'd'))

resolver.resolve(
  { compiler: 'compiler', issuer: 'issuer' },
  '/',
  'test.js',
  function (err, request, result) {
    console.log('---Completed--')
    console.log(err)
    console.log(request)
    console.log(result)
  }
)