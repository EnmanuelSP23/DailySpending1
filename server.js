const express = require('express');
const path = require('path');
const fs = require('fs');

if (!process.env.GOOGLE_CREDENTIALS_B64) {
  const credFile = path.join(__dirname, 'GOOGLE_CREDENTIALS_B64.txt');
  if (fs.existsSync(credFile)) {
    process.env.GOOGLE_CREDENTIALS_B64 = fs.readFileSync(credFile, 'utf8').trim();
  }
}

const handler = require('./netlify/functions/records');
const earningsHandler = require('./netlify/functions/earnings');

const app = express();
const PORT = process.env.PORT || 8888;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.all('/api/records', async (req, res) => {
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  };

  try {
    const result = await handler.handler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.all('/api/earnings', async (req, res) => {
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  };

  try {
    const result = await earningsHandler.handler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
