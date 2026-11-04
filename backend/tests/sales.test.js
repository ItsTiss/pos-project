const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db/pool');

async function createProduct(overrides = {}) {
  const res = await request(app).post('/api/products').send({
    sku: `SKU${Date.now()}${Math.random()}`, name: 'Test', unit_price: 10,
    stock_quantity: 5, unit: 'box', low_stock_threshold: 1, ...overrides
  });
  return res.body;
}

afterEach(() => pool.query('DELETE FROM sale_items; DELETE FROM sales; DELETE FROM products'));
afterAll(() => pool.end());

test('POST /api/sales completes a sale and decrements stock', async () => {
  const product = await createProduct({ stock_quantity: 5 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: 2 }]
  });
  expect(res.status).toBe(201);
  expect(res.body.total_amount).toBe('20.00');
  const check = await request(app).get('/api/products');
  const updated = check.body.find(p => p.id === product.id);
  expect(updated.stock_quantity).toBe(3);
});

test('POST /api/sales rejects and rolls back when quantity exceeds stock', async () => {
  const product = await createProduct({ stock_quantity: 1 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: 5 }]
  });
  expect(res.status).toBe(409);
  const check = await request(app).get('/api/products');
  const unchanged = check.body.find(p => p.id === product.id);
  expect(unchanged.stock_quantity).toBe(1);
  const sales = await pool.query('SELECT * FROM sales');
  expect(sales.rows.length).toBe(0);
});

test('POST /api/sales rejects an empty cart', async () => {
  const res = await request(app).post('/api/sales').send({ items: [] });
  expect(res.status).toBe(400);
});

test('POST /api/sales with multiple items rolls back ALL line items (not just the failing one) on insufficient stock', async () => {
  const okProduct = await createProduct({ stock_quantity: 10 });
  const shortProduct = await createProduct({ stock_quantity: 1 });

  const res = await request(app).post('/api/sales').send({
    items: [
      { product_id: okProduct.id, quantity: 3 },
      { product_id: shortProduct.id, quantity: 5 }
    ]
  });

  expect(res.status).toBe(409);
  expect(res.body.error).toBe('insufficient_stock');
  expect(res.body.product_id).toBe(shortProduct.id);

  const check = await request(app).get('/api/products');
  const okUnchanged = check.body.find(p => p.id === okProduct.id);
  const shortUnchanged = check.body.find(p => p.id === shortProduct.id);
  expect(okUnchanged.stock_quantity).toBe(10);
  expect(shortUnchanged.stock_quantity).toBe(1);

  const sales = await pool.query('SELECT * FROM sales');
  expect(sales.rows.length).toBe(0);
  const saleItems = await pool.query('SELECT * FROM sale_items');
  expect(saleItems.rows.length).toBe(0);
});

test('POST /api/sales copies unit_price_at_sale from the product at sale time (not re-read later)', async () => {
  const product = await createProduct({ stock_quantity: 5, unit_price: 12.34 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: 1 }]
  });
  expect(res.status).toBe(201);
  const saleItem = await pool.query('SELECT unit_price_at_sale FROM sale_items WHERE sale_id = $1', [res.body.id]);
  expect(Number(saleItem.rows[0].unit_price_at_sale)).toBe(12.34);
});
