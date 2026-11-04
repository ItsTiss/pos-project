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
