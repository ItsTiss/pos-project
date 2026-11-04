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
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);
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

test('POST /api/sales rejects with 409 (not 500) when duplicate product_id lines sum beyond stock', async () => {
  const product = await createProduct({ stock_quantity: 5 });
  const res = await request(app).post('/api/sales').send({
    items: [
      { product_id: product.id, quantity: 3 },
      { product_id: product.id, quantity: 3 }
    ]
  });
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('insufficient_stock');

  const check = await request(app).get('/api/products');
  const unchanged = check.body.find(p => p.id === product.id);
  expect(unchanged.stock_quantity).toBe(5);
  const sales = await pool.query('SELECT * FROM sales');
  expect(sales.rows.length).toBe(0);
});

test('POST /api/sales returns 404 product_not_found for an unknown product_id and changes nothing', async () => {
  const okProduct = await createProduct({ stock_quantity: 5 });
  const unknownId = '00000000-0000-0000-0000-000000000000';
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: unknownId, quantity: 1 }]
  });
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('product_not_found');
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);

  const check = await request(app).get('/api/products');
  const unchanged = check.body.find(p => p.id === okProduct.id);
  expect(unchanged.stock_quantity).toBe(5);
  const sales = await pool.query('SELECT * FROM sales');
  expect(sales.rows.length).toBe(0);
});

test('POST /api/sales rejects quantity 0 with 400', async () => {
  const product = await createProduct({ stock_quantity: 5 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: 0 }]
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('invalid_input');
});

test('POST /api/sales rejects negative quantity with 400', async () => {
  const product = await createProduct({ stock_quantity: 5 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: -2 }]
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('invalid_input');
});

test('POST /api/sales rejects a non-integer quantity with 400', async () => {
  const product = await createProduct({ stock_quantity: 5 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: 1.5 }]
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('invalid_input');
});

test('POST /api/sales rejects a string quantity with 400', async () => {
  const product = await createProduct({ stock_quantity: 5 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: '2' }]
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('invalid_input');
});

test('POST /api/sales rejects a malformed product_id with 400 (not 500)', async () => {
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: 'not-a-uuid', quantity: 1 }]
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('invalid_input');
});

// Regression test: previously the 409 insufficient_stock and 404
// product_not_found responses omitted `message`, which the frontend client
// relies on to build the Error it throws (new Error(body.message)). With no
// message, Error('').message is '' (falsy), and Checkout.jsx's
// `{error && <p role="alert">{error}</p>}` guard silently rendered nothing
// -- a cashier saw zero feedback on a rejected sale. Both error responses
// must always include a non-empty `message` field.
test('insufficient_stock and product_not_found responses always include a non-empty message field', async () => {
  const shortProduct = await createProduct({ stock_quantity: 1 });
  const stockRes = await request(app).post('/api/sales').send({
    items: [{ product_id: shortProduct.id, quantity: 5 }]
  });
  expect(stockRes.status).toBe(409);
  expect(stockRes.body.error).toBe('insufficient_stock');
  expect(stockRes.body.message).toBeTruthy();
  expect(typeof stockRes.body.message).toBe('string');

  const unknownId = '00000000-0000-0000-0000-000000000000';
  const notFoundRes = await request(app).post('/api/sales').send({
    items: [{ product_id: unknownId, quantity: 1 }]
  });
  expect(notFoundRes.status).toBe(404);
  expect(notFoundRes.body.error).toBe('product_not_found');
  expect(notFoundRes.body.message).toBeTruthy();
  expect(typeof notFoundRes.body.message).toBe('string');
});
