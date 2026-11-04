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
