// frontend/tests/Checkout.test.jsx
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, test, expect, afterEach } from 'vitest';
import Checkout from '../src/pages/Checkout';
import * as client from '../src/api/client';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('completing a sale calls createSale with cart items and shows a receipt', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([
    { id: '1', sku: 'A1', name: 'Paracetamol', unit_price: 5, stock_quantity: 10 }
  ]);
  vi.spyOn(client, 'createSale').mockResolvedValue({ id: 's1', total_amount: '5.00', items: [] });
  render(<Checkout />);
  fireEvent.click(await screen.findByText(/Paracetamol/i));
  fireEvent.click(screen.getByRole('button', { name: /complete sale/i }));
  await waitFor(() => expect(client.createSale).toHaveBeenCalledWith({ items: [{ product_id: '1', quantity: 1 }] }));
  expect(await screen.findByText(/5\.00/)).toBeInTheDocument();
});

test('clicking the same product twice increments its quantity instead of duplicating the line', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([
    { id: '1', sku: 'A1', name: 'Paracetamol', unit_price: 5, stock_quantity: 10 }
  ]);
  vi.spyOn(client, 'createSale').mockResolvedValue({ id: 's1', total_amount: '10.00', items: [] });
  render(<Checkout />);
  const productButton = await screen.findByText(/Paracetamol/i);
  fireEvent.click(productButton);
  fireEvent.click(productButton);
  fireEvent.click(screen.getByRole('button', { name: /complete sale/i }));
  await waitFor(() =>
    expect(client.createSale).toHaveBeenCalledWith({ items: [{ product_id: '1', quantity: 2 }] })
  );
});

test('the receipt shows the sale id returned by createSale', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([
    { id: '1', sku: 'A1', name: 'Paracetamol', unit_price: 5, stock_quantity: 10 }
  ]);
  vi.spyOn(client, 'createSale').mockResolvedValue({ id: 's1', total_amount: '5.00', items: [] });
  render(<Checkout />);
  fireEvent.click(await screen.findByText(/Paracetamol/i));
  fireEvent.click(screen.getByRole('button', { name: /complete sale/i }));
  expect(await screen.findByText(/s1/)).toBeInTheDocument();
});

test('the cart clears after a successful sale', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([
    { id: '1', sku: 'A1', name: 'Paracetamol', unit_price: 5, stock_quantity: 10 }
  ]);
  vi.spyOn(client, 'createSale').mockResolvedValue({ id: 's1', total_amount: '5.00', items: [] });
  render(<Checkout />);
  fireEvent.click(await screen.findByText(/Paracetamol/i));
  fireEvent.click(screen.getByRole('button', { name: /complete sale/i }));
  await screen.findByText(/5\.00/);
  expect(screen.queryByRole('button', { name: /^remove/i })).not.toBeInTheDocument();
});

test('a failed sale displays the error message and keeps the cart intact', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([
    { id: '1', sku: 'A1', name: 'Paracetamol', unit_price: 5, stock_quantity: 1 }
  ]);
  vi.spyOn(client, 'createSale').mockRejectedValue(new Error('insufficient_stock'));
  render(<Checkout />);
  fireEvent.click(await screen.findByText(/Paracetamol/i));
  fireEvent.click(screen.getByRole('button', { name: /complete sale/i }));
  expect(await screen.findByText(/insufficient_stock/i)).toBeInTheDocument();
  // cart should still contain the line item (not cleared)
  expect(screen.getByRole('button', { name: /^remove/i })).toBeInTheDocument();
});

test('removing a line item from the cart removes it before completing the sale', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([
    { id: '1', sku: 'A1', name: 'Paracetamol', unit_price: 5, stock_quantity: 10 },
    { id: '2', sku: 'B1', name: 'Ibuprofen', unit_price: 3, stock_quantity: 10 }
  ]);
  vi.spyOn(client, 'createSale').mockResolvedValue({ id: 's1', total_amount: '3.00', items: [] });
  render(<Checkout />);
  fireEvent.click(await screen.findByText(/Paracetamol/i));
  fireEvent.click(await screen.findByText(/Ibuprofen/i));
  const removeButtons = screen.getAllByRole('button', { name: /^remove/i });
  fireEvent.click(removeButtons[0]);
  fireEvent.click(screen.getByRole('button', { name: /complete sale/i }));
  await waitFor(() =>
    expect(client.createSale).toHaveBeenCalledWith({ items: [{ product_id: '2', quantity: 1 }] })
  );
});

test('renders the product list from getProducts on mount', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([
    { id: '1', sku: 'A1', name: 'Paracetamol', unit_price: 5, stock_quantity: 10 },
    { id: '2', sku: 'B1', name: 'Ibuprofen', unit_price: 3, stock_quantity: 10 }
  ]);
  render(<Checkout />);
  expect(await screen.findByText(/Paracetamol/i)).toBeInTheDocument();
  expect(await screen.findByText(/Ibuprofen/i)).toBeInTheDocument();
});
