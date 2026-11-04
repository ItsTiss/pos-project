const express = require('express');
const cors = require('cors');

const app = express();

// The React frontend runs on a different origin (Vite dev server on :5173 by
// default) and calls this API directly, so the browser needs CORS headers.
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: CORS_ORIGIN }));

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));

// Unknown routes: JSON 404 instead of Express's default HTML page.
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', message: `No route for ${req.method} ${req.path}` });
});

// Final error handler: always respond with JSON and never leak a stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_input', message: 'Request body is not valid JSON' });
  }

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status < 500) {
    return res.status(status).json({ error: 'invalid_input', message: err.expose && err.message ? err.message : 'Bad request' });
  }

  console.error(err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred' });
});

module.exports = app;
