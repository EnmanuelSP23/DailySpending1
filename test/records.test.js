const { test } = require('node:test')
const assert = require('node:assert/strict')
const { setup, post, valid, headers } = require('./fake-sheets.cjs')
test('persists category in D in master and existing monthly tab with optional notes', async () => {
  const { handler, tabs } = setup()
  assert.equal((await handler(post(valid))).statusCode, 200)
  for (const tab of ['All Data', 'Nov 2026']) {
    assert.deepEqual(tabs[tab][0], headers)
    assert.deepEqual(tabs[tab][1], [12.5, valid.date, '', valid.category])
  }
})
test('rejects malformed JSON, bodies, category and field types before any storage writes', async () => {
  const invalid = [null, [], 'text', 1, {}, ...[undefined, null, '', 'food', ' Food & Drinks', {}, [], 1].map(category => ({ ...valid, category })), ...[{}, [], true, null, '12oops', 'Infinity'].map(amount => ({ ...valid, amount })), ...[{}, [], true, 1, null].map(date => ({ ...valid, date })), ...[{}, [], true, 1, null].map(description => ({ ...valid, description }))]
  for (const body of invalid) {
    const { handler, writes } = setup()
    assert.equal((await handler(post(body))).statusCode, 400, JSON.stringify(body))
    assert.equal(writes.length, 0)
  }
  const { handler, writes } = setup()
  assert.equal((await handler({ httpMethod: 'POST', body: '{' })).statusCode, 400)
  assert.equal(writes.length, 0)
})
test('GET returns stored category and maps absent legacy category to Other', async () => {
  const { handler } = setup({ 'All Data': [headers, [3, valid.date, 'legacy'], [4, valid.date, 'bank', 'Transfers']] })
  const res = await handler({ httpMethod: 'GET' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body).records.map(r => r.category), ['Other', 'Transfers'])
})
test('refreshes stale Stats expense/category formulas once, preserving data rows and current headers', async () => {
  const { handler, tabs, writes } = setup({ 'All Data': [headers, [3, valid.date, 'legacy']] })
  await handler({ httpMethod: 'GET' })
  const grid = tabs.Stats
  assert.equal(grid.length, 52, 'stale Stats must be regenerated')
  assert.match(grid[2][1], /SUMIF.*Transfers/)
  for (const index of [3, ...Array.from({ length: 6 }, (_, i) => i + 8), ...Array.from({ length: 31 }, (_, i) => i + 17)]) {
    assert.match(grid[index][1], /Transfers/)
    assert.doesNotMatch(grid[index][1], /REGEXEXTRACT/)
  }
  assert.match(grid[51][0], /QUERY.*Transfers/)
  assert.match(grid[51][0], /Category/)
  assert.match(grid[51][0], /Other/)
  const count = writes.length
  await handler({ httpMethod: 'GET' })
  assert.equal(writes.length, count, 'current schema must not rewrite on each request')
  assert.deepEqual(tabs['All Data'][1], [3, valid.date, 'legacy'])
})
test('Stats query spill header is not treated as a stale formula', async () => {
  const { handler, tabs, writes } = setup()
  await handler({ httpMethod: 'GET' })
  tabs.Stats[51][1] = 'Total'
  const count = writes.length
  await handler({ httpMethod: 'GET' })
  assert.equal(writes.length, count)
})

test('Stats month/day match stored text date prefixes rather than coercing text timestamps into numeric dates', async () => {
  const { handler, tabs } = setup()
  await handler({ httpMethod: 'GET' })
  assert.match(tabs.Stats[3][1], /SUMPRODUCT.*LEFT\('All Data'!\$B\$2:\$B\$10000,7\)/)
  assert.match(tabs.Stats[17][1], /SUMPRODUCT.*LEFT\('All Data'!\$B\$2:\$B\$10000,10\)/)
  assert.match(tabs.Stats[47][1], /31>DAY\(EOMONTH/)
})
