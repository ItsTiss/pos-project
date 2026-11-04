const express = require('express');

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));

module.exports = app;
