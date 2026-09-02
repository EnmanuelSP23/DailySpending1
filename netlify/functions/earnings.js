const {
  valuesGet,
  valuesAppend,
  getSpreadsheet,
  batchUpdate,
  driveList,
} = require('./goog')

const EARNINGS = 'Earnings'
const EARNINGS_HEADERS = ['Amount', 'Date']

async function getSpreadsheetId() {
  if (process.env.SPREADSHEET_ID) return process.env.SPREADSHEET_ID
  const data = await driveList(`name='Daily Spending' and trashed=false`)
  const file = (data.files || []).find((f) => f.name === 'Daily Spending')
  if (!file) throw new Error('Spreadsheet "Daily Spending" not found')
  return file.id
}

function findTab(metaData, title) {
  return (metaData.sheets || []).find((s) => s.properties.title === title)
}

async function ensureEarnings(metaData, id) {
  let tab = findTab(metaData, EARNINGS)
  if (tab) return tab

  const res = await batchUpdate(id, [{ addSheet: { properties: { title: EARNINGS } } }])
  const sheetId = res.replies[0].addSheet.properties.sheetId
  await valuesAppend(id, `'${EARNINGS}'!A1:B1`, [EARNINGS_HEADERS], 'RAW')
  return { properties: { sheetId, title: EARNINGS } }
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
      await ensureEarnings(metaData, id)
      const res = await valuesGet(id, `'${EARNINGS}'!A:B`)
      const rows = res.values || []
      const records = rows
        .slice(1)
        .filter((r) => r.length >= 2 && r[0] !== '')
        .map((r) => ({
          amount: parseFloat(r[0]),
          date: r[1] || '',
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return bad('date is required (YYYY-MM-DD)')
      }

      await ensureEarnings(metaData, id)
      await valuesAppend(id, `'${EARNINGS}'!A:B`, [[amount, date]], 'RAW')
      return ok({ ok: true })
    }

    return bad('method not allowed', 405)
  } catch (err) {
    console.error(err)
    return bad(err.message || 'Server error', 500)
  }
}
