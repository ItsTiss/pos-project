const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db/pool');
const assertTestDatabase = require('./assertTestDatabase');

afterAll(() => pool.end());

describe('CORS', () => {
  test('OPTIONS preflight from the frontend origin returns Access-Control-Allow-Origin', async () => {
    const res = await request(app)
      .options('/api/products')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  test('simple GET carries the Access-Control-Allow-Origin header', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('CORS_ORIGIN env var overrides the allowed origin', async () => {
    const original = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = 'http://example.test:8080';
    try {
      let isolatedApp;
      jest.isolateModules(() => {
        isolatedApp = require('../src/app');
      });
      const res = await request(isolatedApp)
        .options('/api/health')
        .set('Origin', 'http://example.test:8080')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBe('http://example.test:8080');
    } finally {
      if (original === undefined) delete process.env.CORS_ORIGIN;
      else process.env.CORS_ORIGIN = original;
    }
  });
});

describe('JSON error handling', () => {
  test('malformed JSON body returns 400 JSON, not an HTML page', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Content-Type', 'application/json')
      .send('{"sku": "BAD", ');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error).toBe('invalid_input');
    expect(res.text).not.toMatch(/<html|<pre>|at .*\.js/i);
  });

  test('unknown route returns 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error).toBe('not_found');
  });

  test('an unhandled error in a route returns 500 internal_error JSON with no stack trace', async () => {
    // Make the DB query behind GET /api/products fail; the route passes the
    // error to next(), which must land in app.js's final JSON error handler.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failing = jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('secret internal detail'));
    try {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(500);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({ error: 'internal_error', message: expect.any(String) });
      expect(res.text).not.toMatch(/secret internal detail/);
      expect(res.text).not.toMatch(/\.js:\d+/);
    } finally {
      failing.mockRestore();
      spy.mockRestore();
    }
  });
});

describe('test database safety check', () => {
  test('refuses a DATABASE_URL whose database name does not end in _test', () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://pos:pos@localhost:5432/pharmacy_pos';
    try {
      expect(() => assertTestDatabase()).toThrow(/Refusing to run tests/);
    } finally {
      process.env.DATABASE_URL = original;
    }
  });

  test('accepts a *_test database', () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://pos:pos@localhost:5432/pharmacy_pos_test';
    try {
      expect(() => assertTestDatabase()).not.toThrow();
    } finally {
      process.env.DATABASE_URL = original;
    }
  });
});
