const { api, driveList } = require('./goog')

const SPREADSHEET_NAME = 'Daily Spending'
const HEADERS = ['Amount', 'Date', 'Description']

async function getSpreadsheetId() {
  if (process.env.SPREADSHEET_ID) return process.env.SPREADSHEET_ID
  const data = await driveList(`name='${SPREADSHEET_NAME}' and trashed=false`)
  const file = (data.files || []).find((f) => f.name === SPREADSHEET_NAME)
  if (!file) throw new Error(`Spreadsheet "${SPREADSHEET_NAME}" not found`)
  return file.id
}

function range(id, sheetRange) {
  return `spreadsheets/${id}/values/${sheetRange}`
}

function appendPath(id, sheetRange) {
  return `${range(id, sheetRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
}

async function ensureHeaders(id) {
  const res = await api(range(id, 'A1:C1'))
  if (!res.values || res.values.length === 0) {
    await api(range(id, 'A1:C1'), {
      method: 'PUT',
      body: { values: [HEADERS] },
    })
  }
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
    const spreadsheetId = await getSpreadsheetId()
    await ensureHeaders(spreadsheetId)

    const method = event.httpMethod

    if (method === 'GET') {
      const res = await api(range(spreadsheetId, 'A:C'))
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
      await api(appendPath(spreadsheetId, 'A:C'), {
        method: 'POST',
        body: { values: [[amount, date, description]] },
      })
      return ok({ ok: true })
    }

    return bad('method not allowed', 405)
  } catch (err) {
    console.error(err)
    return bad(err.message || 'Server error', 500)
  }
}