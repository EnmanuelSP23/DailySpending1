const jws = require('jws')

const SCOPE = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

let cachedToken = null
let cachedTokenExp = 0

function getCredentials() {
  const b64 = process.env.GOOGLE_CREDENTIALS_B64
  if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  const json = process.env.GOOGLE_CREDENTIALS_JSON
  if (json) return JSON.parse(json)
  throw new Error(
    'Google credentials not found. Set the GOOGLE_CREDENTIALS_B64 environment variable (base64 of credentials.json).'
  )
}

function signJwt(creds) {
  const now = Math.floor(Date.now() / 1000)
  return jws.sign({
    header: { alg: 'RS256', typ: 'JWT', kid: creds.private_key_id },
    payload: {
      iss: creds.client_email,
      scope: SCOPE,
      aud: creds.token_uri,
      iat: now,
      exp: now + 3600,
    },
    secret: creds.private_key,
  })
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedTokenExp > now + 60) return cachedToken

  const creds = getCredentials()
  const res = await fetch(creds.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signJwt(creds),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error('Token request failed (' + res.status + '): ' + text)
  }
  const data = await res.json()
  if (!data.access_token) {
    throw new Error('Token response missing access_token')
  }
  cachedToken = data.access_token
  cachedTokenExp = now + (data.expires_in || 3600)
  return cachedToken
}

async function api(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken()
  const url = path.startsWith('http') ? path : 'https://sheets.googleapis.com/v4/' + path
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error('Google API error (' + res.status + '): ' + text)
  }
  return res.json()
}

function encRange(range) {
  return encodeURIComponent(range)
}

async function valuesGet(id, range) {
  return api(`spreadsheets/${id}/values/${encRange(range)}`)
}

async function valuesUpdate(id, range, values, valueInputOption = 'RAW') {
  return api(`spreadsheets/${id}/values/${encRange(range)}?valueInputOption=${valueInputOption}`, {
    method: 'PUT',
    body: { values },
  })
}

async function valuesAppend(id, range, values, valueInputOption = 'USER_ENTERED') {
  return api(
    `spreadsheets/${id}/values/${encRange(range)}:append?valueInputOption=${valueInputOption}&insertDataOption=OVERWRITE`,
    { method: 'POST', body: { values } }
  )
}

async function valuesClear(id, range) {
  return api(`spreadsheets/${id}/values/${encRange(range)}:clear`, { method: 'POST', body: {} })
}

async function getSpreadsheet(id) {
  return api(
    `spreadsheets/${id}?fields=sheets.properties.title,sheets.properties.sheetId,sheets.properties.index,sheets.charts`
  )
}

async function batchUpdate(id, requests) {
  return api(`spreadsheets/${id}:batchUpdate`, { method: 'POST', body: { requests } })
}

async function driveList(query) {
  const token = await getAccessToken()
  const url = 'https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name)' +
    '&q=' + encodeURIComponent(query)
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error('Drive API error (' + res.status + '): ' + text)
  }
  return res.json()
}

module.exports = {
  getCredentials,
  api,
  valuesGet,
  valuesUpdate,
  valuesAppend,
  valuesClear,
  getSpreadsheet,
  batchUpdate,
  driveList,
}