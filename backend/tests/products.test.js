const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db/pool');

afterEach(() => pool.query('DELETE FROM products'));
afterAll(() => pool.end());

test('POST /api/products creates a product', async () => {
  const res = await request(app).post('/api/products').send({
    sku: 'ABC123', name: 'Paracetamol', unit_price: 5.50,
    stock_quantity: 100, unit: 'box', low_stock_threshold: 10
  });
  expect(res.status).toBe(201);
  expect(res.body.sku).toBe('ABC123');
});

test('POST /api/products rejects duplicate sku', async () => {
  const body = { sku: 'DUP1', name: 'X', unit_price: 1, stock_quantity: 1, unit: 'box', low_stock_threshold: 1 };
  await request(app).post('/api/products').send(body);
  const res = await request(app).post('/api/products').send(body);
  expect(res.status).toBe(409);
});

test('POST /api/products rejects non-positive unit_price', async () => {
  const res = await request(app).post('/api/products').send({
    sku: 'NEG1', name: 'X', unit_price: 0, stock_quantity: 1, unit: 'box', low_stock_threshold: 1
  });
  expect(res.status).toBe(400);
});

test('POST /api/products rejects negative stock_quantity', async () => {
  const res = await request(app).post('/api/products').send({
    sku: 'NEG2', name: 'X', unit_price: 1, stock_quantity: -1, unit: 'box', low_stock_threshold: 1
  });
  expect(res.status).toBe(400);
});

test('GET /api/products?lowStock=true includes products where stock_quantity equals threshold', async () => {
  await request(app).post('/api/products').send({
    sku: 'LOW1', name: 'EdgeCase', unit_price: 1, stock_quantity: 5, unit: 'box', low_stock_threshold: 5
  });
  const res = await request(app).get('/api/products?lowStock=true');
  expect(res.body.some(p => p.sku === 'LOW1')).toBe(true);
});

test('GET /api/products?search=... matches by name or sku substring', async () => {
  await request(app).post('/api/products').send({
    sku: 'SRCH1', name: 'Amoxicillin', unit_price: 2, stock_quantity: 10, unit: 'box', low_stock_threshold: 1
  });
  await request(app).post('/api/products').send({
    sku: 'OTHER1', name: 'Vitamin C', unit_price: 3, stock_quantity: 10, unit: 'box', low_stock_threshold: 1
  });

  const byName = await request(app).get('/api/products?search=Amoxi');
  expect(byName.status).toBe(200);
  expect(byName.body.some(p => p.sku === 'SRCH1')).toBe(true);
  expect(byName.body.some(p => p.sku === 'OTHER1')).toBe(false);

  const bySku = await request(app).get('/api/products?search=OTHER1');
  expect(bySku.status).toBe(200);
  expect(bySku.body.some(p => p.sku === 'OTHER1')).toBe(true);
});

test('PUT /api/products/:id updates a product and returns 200 with the updated row', async () => {
  const created = await request(app).post('/api/products').send({
    sku: 'PUT1', name: 'Ibuprofen', unit_price: 4, stock_quantity: 20, unit: 'box', low_stock_threshold: 2
  });

  const res = await request(app).put(`/api/products/${created.body.id}`).send({
    sku: 'PUT1', name: 'Ibuprofen 400mg', unit_price: 4.5, stock_quantity: 25, unit: 'box', low_stock_threshold: 2
  });

  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Ibuprofen 400mg');
  expect(Number(res.body.unit_price)).toBe(4.5);
  expect(res.body.stock_quantity).toBe(25);
});

test('PUT /api/products/:id on a non-existent id returns 404', async () => {
  const res = await request(app).put('/api/products/00000000-0000-0000-0000-000000000099').send({
    sku: 'NOPE', name: 'Ghost', unit_price: 1, stock_quantity: 1, unit: 'box', low_stock_threshold: 1
  });
  expect(res.status).toBe(404);
});

test('PUT /api/products/:id colliding with another product\'s sku returns 409', async () => {
  const first = await request(app).post('/api/products').send({
    sku: 'COL1', name: 'First', unit_price: 1, stock_quantity: 1, unit: 'box', low_stock_threshold: 1
  });
  const second = await request(app).post('/api/products').send({
    sku: 'COL2', name: 'Second', unit_price: 1, stock_quantity: 1, unit: 'box', low_stock_threshold: 1
  });

  const res = await request(app).put(`/api/products/${second.body.id}`).send({
    sku: 'COL1', name: 'Second', unit_price: 1, stock_quantity: 1, unit: 'box', low_stock_threshold: 1
  });

  expect(res.status).toBe(409);
});

test('POST /api/products with a missing required field returns 400 JSON, not a 500', async () => {
  const res = await request(app).post('/api/products').send({
    sku: 'MISSING1', unit_price: 1, stock_quantity: 1, unit: 'box', low_stock_threshold: 1
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('invalid_input');
});
