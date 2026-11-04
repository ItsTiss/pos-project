const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.post('/', async (req, res, next) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'invalid_input', message: 'items is required and must be a non-empty array' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const lineItems = [];

    for (const item of items) {
      const { product_id, quantity } = item;

      const productResult = await client.query(
        'SELECT unit_price, stock_quantity FROM products WHERE id = $1 FOR UPDATE',
        [product_id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'product_not_found', product_id });
      }

      const { unit_price, stock_quantity } = productResult.rows[0];

      if (stock_quantity < quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'insufficient_stock', product_id });
      }

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
      // ignore rollback errors; original error takes precedence
    }
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
