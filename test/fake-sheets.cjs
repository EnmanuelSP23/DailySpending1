const headers = ['Amount', 'Date', 'Description', 'Category']
function setup(initial = {}) {
  const tabs = { 'All Data': [['Amount', 'Date', 'Description']], Stats: [['old stats']], 'Nov 2026': [['Amount', 'Date', 'Description']], ...initial }
  const writes = []
  const read = range => { const [, tab, cells] = /^'([^']+)'!(.*)$/.exec(range); return { tab, cells } }
  const storage = {
    driveList: async () => ({ files: [{ name: 'Daily Spending', id: 'fake' }] }),
    getSpreadsheet: async () => ({ sheets: Object.keys(tabs).map((title, index) => ({ properties: { title, index, sheetId: index + 1 }, charts: ['Monthly Totals', 'Daily Spending', 'Top Spending'].map(title => ({ spec: { title } })) })) }),
    valuesGet: async (id, range, option) => { const {tab, cells} = read(range); const rows = tabs[tab] || []; return { values: structuredClone(cells === 'A:D' ? rows : cells === 'A1:D1' ? rows.slice(0, 1) : rows) } },
    valuesUpdate: async (id, range, values, option) => { writes.push({ range, values, option }); const {tab} = read(range); tabs[tab] = structuredClone(values).concat((tabs[tab] || []).slice(values.length)); return {} },
    valuesAppend: async (id, range, values, option) => { writes.push({ range, values, option }); const {tab} = read(range); tabs[tab].push(...structuredClone(values)); return {} },
    batchUpdate: async (id, requests) => { writes.push({ requests }); return { replies: requests.map(r => { if (r.addSheet) { const title = r.addSheet.properties.title; tabs[title] = []; return { addSheet: { properties: { sheetId: Object.keys(tabs).length } } } } return {} }) } }
  }
  const goog = require.resolve('../netlify/functions/goog')
  require.cache[goog] = { id: goog, filename: goog, loaded: true, exports: storage }
  const records = require.resolve('../netlify/functions/records'); delete require.cache[records]
  return { handler: require(records).handler, tabs, writes }
}
const valid = { amount: '12.50', date: '2026-11-02 09:30', category: 'Food & Drinks' }
const post = body => ({ httpMethod: 'POST', body: JSON.stringify(body) })
module.exports = { setup, post, valid, headers }
