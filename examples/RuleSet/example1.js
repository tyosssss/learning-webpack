const { RuleSet } = require('../common')
const matcher = (condition, value) =>
  console.log(`(${condition.title})("${value}") ==> ${condition(value)}`)
const exec = (type, expr, ...value) => {
  let condition = RuleSet.normalizeCondition(expr)
  condition.title = expr.toString()

  console.log(type)
  value.forEach(v => matcher(condition, v))
  console.log(' ')
}

exec('String', 'index', 'index_aaa', 'aaa')
exec('RegExp', /aaa$/, 'index_aaa', 'a')
exec('Function', str => str === "ABC", 'ABC', 'ABCD')
exec('Array', ['a', 'b', 'c'], 'dddd', 'aff', 'bfff', 'cfff')
exec(
  'Complex',
  {
    not: 'a'
  },
  'bbb',
  'abb'
)

// /^[a|b|c]/.test(value)
exec(
  'Complex',
  {
    or: ['a', 'b', 'c'],
  },
  'dddd',
  'aff',
  'bfff',
  'cfff'
)

// value.indexOf('a') === 0 && /b$/.test(value)
exec(
  'Complex',
  {
    include: 'a',
    include: /b$/
  },
  'dddd',
  'aff',
  'abbsdfb',
  'cfff'
)

exec(
  'Complex',
  {
    and: ['a', /b$/]
  },
  'dddd',
  'aff',
  'abbsdfb',
  'cfff'
)