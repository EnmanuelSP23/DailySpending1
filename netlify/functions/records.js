const {
  valuesGet,
  valuesUpdate,
  valuesAppend,
  getSpreadsheet,
  batchUpdate,
  driveList,
} = require('./goog')

const SPREADSHEET_NAME = 'Daily Spending'
const ALL_DATA = 'All Data'
const STATS = 'Stats'
const HEADERS = ['Amount', 'Date', 'Description']

async function getSpreadsheetId() {
  if (process.env.SPREADSHEET_ID) return process.env.SPREADSHEET_ID
  const data = await driveList(`name='${SPREADSHEET_NAME}' and trashed=false`)
  const file = (data.files || []).find((f) => f.name === SPREADSHEET_NAME)
  if (!file) throw new Error(`Spreadsheet "${SPREADSHEET_NAME}" not found`)
  return file.id
}

function findTab(metaData, title) {
  return (metaData.sheets || []).find((s) => s.properties.title === title)
}

function firstTab(metaData) {
  return (metaData.sheets || []).slice().sort((a, b) => a.properties.index - b.properties.index)[0]
}

async function ensureAllData(metaData, id) {
  let tab = findTab(metaData, ALL_DATA)

  if (!tab) {
    const first = firstTab(metaData)
    if (first) {
      await batchUpdate(id, [
        {
          updateSheetProperties: {
            properties: { sheetId: first.properties.sheetId, title: ALL_DATA },
            fields: 'title',
          },
        },
      ])
      tab = first
      tab.properties.title = ALL_DATA
    } else {
      const res = await batchUpdate(id, [{ addSheet: { properties: { title: ALL_DATA } } }])
      const sheetId = res.replies[0].addSheet.properties.sheetId
      tab = { properties: { sheetId, title: ALL_DATA } }
    }
  }

  const got = await valuesGet(id, `'${ALL_DATA}'!A1:C1`)
  if (!got.values || got.values.length === 0) {
    await valuesUpdate(id, `'${ALL_DATA}'!A1:C1`, [HEADERS])
  }
  return tab
}

function buildStatsGrid() {
  const rows = []
  const push = (a, b) => rows.push([a === undefined ? '' : a, b === undefined ? '' : b])
  const dayRegex = '"^\\d{4}-\\d{2}-\\d{2}"'
  const monthRegex = '"^\\d{4}-\\d{2}"'

  push('Daily Spending - Stats', '')
  push('', '')
  push('All Time Total', "=SUM('All Data'!$A$2:$A$10000)")
  push('This Month', `=SUMIFS('All Data'!$A$2:$A$10000,ARRAYFORMULA(REGEXEXTRACT('All Data'!$B$2:$B$10000,${monthRegex})),TEXT(TODAY(),"YYYY-MM"))`)
  push('Entries', "=COUNT('All Data'!$A$2:$A$10000)")
  push('', '')
  push('Monthly Totals', '')
  push('Month', 'Total')
  for (let m = 0; m < 6; m++) {
    push(
      `=TEXT(EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),-${m}),"MMM YYYY")`,
      `=SUMIFS('All Data'!$A$2:$A$10000,ARRAYFORMULA(REGEXEXTRACT('All Data'!$B$2:$B$10000,${monthRegex})),TEXT(EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),-${m}),"YYYY-MM"))`
    )
  }
  push('', '')
  push('Daily Totals (This Month)', '')
  push('Day', 'Total')
  for (let d = 1; d <= 31; d++) {
    push(
      d,
      `=SUMIFS('All Data'!$A$2:$A$10000,ARRAYFORMULA(REGEXEXTRACT('All Data'!$B$2:$B$10000,${dayRegex})),TEXT(DATE(YEAR(TODAY()),MONTH(TODAY()),${d}),"YYYY-MM-DD"))`
    )
  }
  push('', '')
  push('Top Spending', '')
  push('', '')
  push(
    `=QUERY('All Data'!$A$2:$C$10000,"select C, sum(A) where C is not null and C <> '' group by C order by sum(A) desc limit 5 label C 'Description', sum(A) 'Total'",-1)`,
    ''
  )
  return rows
}

function chartGrid(sheetId, r0, r1) {
  return [{ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: 0, endColumnIndex: 1 }]
}

function seriesGrid(sheetId, r0, r1) {
  return [{ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: 1, endColumnIndex: 2 }]
}

function anchor(sheetId, rowIndex, columnIndex, width, height) {
  return {
    overlayPosition: {
      anchorCell: { sheetId, rowIndex, columnIndex },
      widthPixels: width,
      heightPixels: height,
    },
  }
}

function chartDefs(sheetId) {
  return [
    {
      spec: {
        title: 'Monthly Totals',
        basicChart: {
          chartType: 'BAR',
          legendPosition: 'NO_LEGEND',
          headerCount: 1,
          axis: [
            { position: 'BOTTOM_AXIS', title: 'Total ($)' },
            { position: 'LEFT_AXIS', title: 'Month' },
          ],
          domains: [{ domain: { sourceRange: { sources: chartGrid(sheetId, 7, 14) } } }],
          series: [
            {
              series: { sourceRange: { sources: seriesGrid(sheetId, 7, 14) } },
              targetAxis: 'BOTTOM_AXIS',
            },
          ],
        },
      },
      position: anchor(sheetId, 0, 4, 460, 260),
    },
    {
      spec: {
        title: 'Daily Spending',
        basicChart: {
          chartType: 'LINE',
          legendPosition: 'NO_LEGEND',
          headerCount: 1,
          axis: [
            { position: 'BOTTOM_AXIS', title: '' },
            { position: 'LEFT_AXIS', title: '' },
          ],
          domains: [{ domain: { sourceRange: { sources: chartGrid(sheetId, 16, 48) } } }],
          series: [
            {
              series: { sourceRange: { sources: seriesGrid(sheetId, 16, 48) } },
              targetAxis: 'LEFT_AXIS',
            },
          ],
        },
      },
      position: anchor(sheetId, 15, 4, 460, 240),
    },
    {
      spec: {
        title: 'Top Spending',
        pieChart: {
          legendPosition: 'RIGHT_LEGEND',
          threeDimensional: false,
          domain: { sourceRange: { sources: chartGrid(sheetId, 51, 58) } },
          series: { sourceRange: { sources: seriesGrid(sheetId, 51, 58) } },
        },
      },
      position: anchor(sheetId, 49, 4, 380, 260),
    },
  ]
}

async function ensureCharts(id, tab, metaData) {
  const meta = (metaData.sheets || []).find((s) => s.properties.sheetId === tab.properties.sheetId)
  const existing = new Set((meta && meta.charts ? meta.charts : []).map((c) => c.spec && c.spec.title))
  const requests = chartDefs(tab.properties.sheetId)
    .filter((d) => !existing.has(d.spec.title))
    .map((d) => ({ addChart: { chart: d } }))
  if (requests.length) {
    await batchUpdate(id, requests)
  }
}

async function ensureStats(metaData, id) {
  const tab = findTab(metaData, STATS)

  if (tab) {
    const got = await valuesGet(id, `'${STATS}'!A1:B5`)
    if (!got.values || got.values.length === 0) {
      await valuesUpdate(id, `'${STATS}'!A1:B52`, buildStatsGrid(), 'USER_ENTERED')
    }
    try {
      await ensureCharts(id, tab, metaData)
    } catch (err) {
      console.error('chart creation failed:', err.message)
    }
    return tab
  }

  const res = await batchUpdate(id, [{ addSheet: { properties: { title: STATS } } }])
  const sheetId = res.replies[0].addSheet.properties.sheetId
  await valuesUpdate(id, `'${STATS}'!A1:B52`, buildStatsGrid(), 'USER_ENTERED')
  try {
    await ensureCharts(id, { properties: { sheetId, title: STATS } }, metaData)
  } catch (err) {
    console.error('chart creation failed:', err.message)
  }
  return { properties: { sheetId, title: STATS } }
}

async function ensureMonthTab(metaData, id, monthName) {
  let tab = findTab(metaData, monthName)
  if (tab) return tab
  const res = await batchUpdate(id, [{ addSheet: { properties: { title: monthName } } }])
  const sheetId = res.replies[0].addSheet.properties.sheetId
  await valuesUpdate(id, `'${monthName}'!A1:C1`, [HEADERS])
  return { properties: { sheetId, title: monthName } }
}

function monthLabelFromDate(dateStr) {
  const m = /^(\d{4})-(\d{2})/.exec(dateStr || '')
  if (!m) return ''
  const year = Number(m[1])
  const month = Number(m[2])
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' })
  return `${label} ${year}`
}

function ok(payload) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

function bad(message, statusCode = 400) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  }
}

exports.handler = async (event) => {
  try {
    const id = await getSpreadsheetId()
    const metaData = await getSpreadsheet(id)
    const method = event.httpMethod

    if (method === 'GET') {
      await ensureAllData(metaData, id)
      await ensureStats(metaData, id)
      const res = await valuesGet(id, `'${ALL_DATA}'!A:C`)
      const rows = res.values || []
      const records = rows
        .slice(1)
        .filter((r) => r.length >= 2 && r[0] !== '')
        .map((r) => ({
          amount: parseFloat(r[0]),
          date: r[1] || '',
          description: r[2] || '',
        }))
      return ok({ records })
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const amount = parseFloat(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return bad('amount must be a positive number')
      }
      const date = (body.date || '').trim()
      const description = (body.description || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
        return bad('date is required (YYYY-MM-DD HH:mm)')
      }

      await ensureAllData(metaData, id)
      await ensureStats(metaData, id)

      const monthName = monthLabelFromDate(date)
      if (monthName) {
        await ensureMonthTab(metaData, id, monthName)
      }

      const row = [amount, date, description]
      await valuesAppend(id, `'${ALL_DATA}'!A:C`, [row], 'RAW')
      if (monthName) {
        await valuesAppend(id, `'${monthName}'!A:C`, [row], 'RAW')
      }
      return ok({ ok: true })
    }

    return bad('method not allowed', 405)
  } catch (err) {
    console.error(err)
    return bad(err.message || 'Server error', 500)
  }
}