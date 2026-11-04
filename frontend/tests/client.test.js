// frontend/tests/client.test.js
import { describe, test, expect, vi, afterEach } from 'vitest';
import { getProducts, createSale } from '../src/api/client';

afterEach(() => vi.restoreAllMocks());

test('getProducts calls the products endpoint and returns parsed JSON', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: '1' }] });
  const result = await getProducts({ search: 'abc' });
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/products?search=abc'));
  expect(result).toEqual([{ id: '1' }]);
});

test('createSale throws with API message on failure', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'insufficient stock' }) });
  await expect(createSale({ items: [] })).rejects.toThrow('insufficient stock');
});

// Regression test: the real backend's 409 insufficient_stock (and 404
// product_not_found) responses previously had no `message` field, only
// `error` and `product_id`. handleResponse did `throw new Error(body.message)`,
// so with body.message undefined, the thrown Error's message was the empty
// string '' -- falsy, so Checkout.jsx's `{error && <p role="alert">...}`
// guard rendered nothing and the cashier saw no feedback at all. This test
// mocks fetch with that exact real-world shape (no message field) to pin
// the fallback-to-body.error fix in handleResponse.
test('createSale throws a non-empty error when the API response has no message field (real backend shape)', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'insufficient_stock', product_id: 'abc-123' }),
  });
  await expect(createSale({ items: [] })).rejects.toThrow(/insufficient_stock/);
  try {
    await createSale({ items: [] });
  } catch (err) {
    expect(err.message).toBeTruthy();
    expect(err.message.length).toBeGreaterThan(0);
  }
});
