// frontend/tests/Inventory.test.jsx
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, test, expect, afterEach } from 'vitest';
import Inventory from '../src/pages/Inventory';
import * as client from '../src/api/client';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('submitting the form calls createProduct and refreshes the list', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([]);
  vi.spyOn(client, 'createProduct').mockResolvedValue({ id: '1', sku: 'ABC', name: 'Test' });
  render(<Inventory />);
  fireEvent.change(screen.getByLabelText(/sku/i), { target: { value: 'ABC' } });
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(client.createProduct).toHaveBeenCalled());
});

test('"Show low stock only" calls getProducts({lowStock: true}) and renders only that list', async () => {
  const healthy = { id: '1', sku: 'OK-1', name: 'Plenty', unit_price: '2.00', stock_quantity: 50, unit: 'box', low_stock_threshold: 5 };
  const low = { id: '2', sku: 'LOW-1', name: 'Running Out', unit_price: '3.00', stock_quantity: 2, unit: 'box', low_stock_threshold: 5 };
  vi.spyOn(client, 'getProducts').mockImplementation(async ({ lowStock } = {}) =>
    lowStock ? [low] : [healthy, low]
  );

  render(<Inventory />);
  expect(await screen.findByText('OK-1')).toBeInTheDocument();
  expect(screen.getByText('LOW-1')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText(/show low stock only/i));

  await waitFor(() => expect(client.getProducts).toHaveBeenLastCalledWith({ lowStock: true }));
  await waitFor(() => expect(screen.queryByText('OK-1')).not.toBeInTheDocument());
  expect(screen.getByText('LOW-1')).toBeInTheDocument();

  // Unticking restores the full list.
  fireEvent.click(screen.getByLabelText(/show low stock only/i));
  expect(await screen.findByText('OK-1')).toBeInTheDocument();
});

test('editing a product prefills the form, submits an update, and clears edit state', async () => {
  const existingProduct = {
    id: '42',
    sku: 'EXIST-1',
    name: 'Existing Product',
    unit_price: 9.99,
    stock_quantity: 10,
    unit: 'box',
    low_stock_threshold: 2,
  };
  vi.spyOn(client, 'getProducts').mockResolvedValue([existingProduct]);
  vi.spyOn(client, 'updateProduct').mockResolvedValue({ ...existingProduct, name: 'Updated Product' });

  render(<Inventory />);

  // Wait for the initial list to load and the row to appear.
  await waitFor(() => expect(screen.getByText('EXIST-1')).toBeTruthy());

  // Click Edit on the existing product's row.
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));

  // Form should now be prefilled with that product's values.
  await waitFor(() => expect(screen.getByLabelText(/sku/i).value).toBe('EXIST-1'));
  expect(screen.getByLabelText(/^name/i).value).toBe('Existing Product');
  expect(screen.getByLabelText(/unit price/i).value).toBe('9.99');
  expect(screen.getByLabelText(/stock quantity/i).value).toBe('10');
  expect(screen.getByLabelText(/^unit$/i).value).toBe('box');
  expect(screen.getByLabelText(/low stock threshold/i).value).toBe('2');

  // Change a field and submit.
  fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Updated Product' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  // updateProduct should be called with the correct id and updated data.
  await waitFor(() =>
    expect(client.updateProduct).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({
        sku: 'EXIST-1',
        name: 'Updated Product',
        unit_price: 9.99,
        stock_quantity: 10,
        unit: 'box',
        low_stock_threshold: 2,
      })
    )
  );

  // The list refetches afterward.
  await waitFor(() => expect(client.getProducts).toHaveBeenCalledTimes(2));

  // Edit state clears: form returns to its empty/create state.
  await waitFor(() => expect(screen.getByLabelText(/sku/i).value).toBe(''));
  expect(screen.getByLabelText(/^name/i).value).toBe('');
});
