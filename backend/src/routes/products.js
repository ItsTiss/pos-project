const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const UNIQUE_VIOLATION = '23505';

function validateProductBody(body) {
  const { sku, name, unit, unit_price } = body;

  if (typeof sku !== 'string' || sku.trim() === '') {
    return 'sku is required';
  }

  if (typeof name !== 'string' || name.trim() === '') {
    return 'name is required';
  }

  if (typeof unit !== 'string' || unit.trim() === '') {
    return 'unit is required';
  }

  // unit_price is stored as NUMERIC(10,2): it must be a finite number that
  // is still > 0 after rounding to cents (0.001 would round to 0.00) and fits
  // in the column (max 99999999.99).
  const price = toNumber(unit_price);
  if (!Number.isFinite(price) || Math.round(price * 100) <= 0) {
    return 'unit_price must be greater than 0';
  }
  if (price > MAX_PRICE) {
    return `unit_price must be at most ${MAX_PRICE}`;
  }

  for (const field of ['stock_quantity', 'low_stock_threshold']) {
    const value = toNumber(body[field]);
    if (!Number.isInteger(value) || value < 0 || value > MAX_INT) {
      return `${field} is required and must be an integer greater than or equal to 0`;
    }
  }

  return null;
}

const MAX_PRICE = 99999999.99;
const MAX_INT = 2147483647;

// Accept JSON numbers or numeric strings; anything else (blank string, null,
// missing, boolean, object) becomes NaN so it fails validation.
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

router.get('/', async (req, res, next) => {
  try {
    const { search, lowStock } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length})`);
    }

    if (lowStock === 'true') {
      conditions.push('stock_quantity <= low_stock_threshold');
    }

    let query = 'SELECT * FROM products';
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { sku, name, unit_price, stock_quantity, unit, low_stock_threshold } = req.body;

    const validationError = validateProductBody(req.body);
    if (validationError) {
      return res.status(400).json({ error: 'invalid_input', message: validationError });
    }

    const result = await pool.query(
      `INSERT INTO products (sku, name, unit_price, stock_quantity, unit, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [sku, name, unit_price, stock_quantity, unit, low_stock_threshold]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      return res.status(409).json({ error: 'duplicate_sku', message: `Product with sku '${req.body.sku}' already exists` });
    }
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sku, name, unit_price, stock_quantity, unit, low_stock_threshold } = req.body;

    const validationError = validateProductBody(req.body);
    if (validationError) {
      return res.status(400).json({ error: 'invalid_input', message: validationError });
    }

    const result = await pool.query(
      `UPDATE products
       SET sku = $1, name = $2, unit_price = $3, stock_quantity = $4, unit = $5, low_stock_threshold = $6, updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [sku, name, unit_price, stock_quantity, unit, low_stock_threshold, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: `Product with id '${id}' not found` });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      return res.status(409).json({ error: 'duplicate_sku', message: `Product with sku '${req.body.sku}' already exists` });
    }
    next(err);
  }
});

module.exports = router;
