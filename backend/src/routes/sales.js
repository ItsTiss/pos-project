const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post('/', async (req, res, next) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'invalid_input', message: 'items is required and must be a non-empty array' });
  }

  for (const item of items) {
    const { product_id, quantity } = item || {};

    if (typeof product_id !== 'string' || !UUID_RE.test(product_id)) {
      return res.status(400).json({ error: 'invalid_input', message: 'each item must have a valid product_id' });
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'invalid_input', message: 'each item must have an integer quantity >= 1' });
    }
  }

  // Aggregate requested quantities per product so duplicate lines for the
  // same product are checked against stock in total, not independently.
  const requestedByProduct = new Map();
  for (const { product_id, quantity } of items) {
    requestedByProduct.set(product_id, (requestedByProduct.get(product_id) || 0) + quantity);
  }

  // Lock/select products in a fixed order (sorted by id) across all
  // concurrent transactions to avoid lock-order deadlocks.
  const sortedProductIds = Array.from(requestedByProduct.keys()).sort();

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    return next(err);
  }

  try {
    await client.query('BEGIN');

    const priceByProduct = new Map();

    for (const product_id of sortedProductIds) {
      const totalRequested = requestedByProduct.get(product_id);

      const productResult = await client.query(
        'SELECT unit_price, stock_quantity FROM products WHERE id = $1 FOR UPDATE',
        [product_id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'product_not_found', product_id });
      }

      const { unit_price, stock_quantity } = productResult.rows[0];

      if (stock_quantity < totalRequested) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'insufficient_stock', product_id });
      }

      priceByProduct.set(product_id, unit_price);
    }

    let totalAmount = 0;
    const lineItems = [];
    for (const item of items) {
      const { product_id, quantity } = item;
      const unit_price = priceByProduct.get(product_id);
      totalAmount += Number(unit_price) * quantity;
      lineItems.push({ product_id, quantity, unit_price_at_sale: unit_price });
    }

    const saleResult = await client.query(
      'INSERT INTO sales (total_amount) VALUES ($1) RETURNING id, total_amount, created_at',
      [totalAmount.toFixed(2)]
    );
    const sale = saleResult.rows[0];

    const insertedItems = [];
    for (const lineItem of lineItems) {
      const itemResult = await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_at_sale)
         VALUES ($1, $2, $3, $4)
         RETURNING id, sale_id, product_id, quantity, unit_price_at_sale`,
        [sale.id, lineItem.product_id, lineItem.quantity, lineItem.unit_price_at_sale]
      );
      insertedItems.push(itemResult.rows[0]);

      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [lineItem.quantity, lineItem.product_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      id: sale.id,
      total_amount: sale.total_amount,
      created_at: sale.created_at,
      items: insertedItems
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // ROLLBACK itself failed; the connection may be in a broken state.
      // Pass the error to release() so node-postgres discards it instead
      // of returning it to the pool for reuse.
      client.release(rollbackErr);
      client = null;
      return next(err);
    }
    next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
