const {
  createAsync, Tapable, callback, log
} = require('../common')

const time = () => Math.floor(Math.random() * 1000 - 500)
const destiny = () => Math.random() < .8

class Compilation extends Tapable {
  constructor(options) {
    super()

    this.isGod = options.godMode

    this.plugin('seal', function (callback) {
      console.log('seal')
      callback(null, [this.modules])
      // callback()
    })
  }

  run(entries) {
    let value = this.applyPluginsWaterfall('before-compile', { chunks: [] })

    Object.assign(this, value)

    this.applyPluginsParallel('make', entries, (err, results) => {
      if (err) {
        this.applyPlugins('compile-error', err)
        return
      }

      // this.applyPluginsAsyncSeriesBailResult('seal', (err, chunks) => {
      this.applyPluginsParallelBailResult('seal', (err, chunks) => {
        if (err) {
          this.applyPlugins('compile-error', err)
          return
        }

        this.chunks = chunks

        this.applyPlugins('compile-success', {
          modules: this.modules,
          chunks: this.chunks
        })
      })
    })
  }
}

class InitPlugin {
  constructor() {

  }

  apply(compilation) {
    compilation.plugin('before-compile', function (current) {
      current.modules = {}

      return current
    })
  }
}

class Compile1Plugin {
  constructor() {

  }

  apply(compilation) {
    compilation.plugin('make', function (entries, callback) {
      setTimeout(() => {
        for (let [key, value] of entries) {
          if (typeof value === 'function') {
            this.modules[key] = value
          }
        }

        callback()
      }, time())
    })
  }
}

class Compile2Plugin {
  constructor() {

  }

  apply(compilation) {
    compilation.plugin('make', function (entries, callback) {
      setTimeout(() => {
        for (let [key, value] of entries) {
          if (typeof value === 'string') {
            this.modules[key] = () => console.log(value)
          }
        }

        callback(!this.isGod && destiny() ? { message: '发生错误' } : null)
      }, time())
    })
  }
}

class SealPlugin {
  constructor() {

  }

  apply(compilation) {
    compilation.plugin('seal', function (callback) {
      console.log('custom-seal')

      callback(null, [])
    })
  }
}

class ResultPlugin {
  constructor() {

  }

  apply(compilation) {
    compilation.plugin('compile-success', function (results) {
      console.log('success')

      for (let k in results.modules) {
        results.modules[k]()
      }

      console.log('chunks', this.chunks)
    })

    compilation.plugin('compile-error', function (err) {
      console.error('error')
      console.error(err)
    })
  }
}

const compilation = new Compilation({
  godMode: true
})

compilation.apply(new InitPlugin())
compilation.apply(new Compile1Plugin())
compilation.apply(new Compile2Plugin())
compilation.apply(new SealPlugin())
compilation.apply(new ResultPlugin())

const entries = new Map()

entries.set('a', function () { console.log('a') })
entries.set('b', function () { console.log('b') })
entries.set('c', function () { console.log('c') })
entries.set('d', 'd')
entries.set('f', 'f')

compilation.run(entries)