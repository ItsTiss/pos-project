// frontend/tests/Cart.test.jsx
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import Cart from '../src/components/Cart';

afterEach(() => {
  cleanup();
});

test('renders total as the sum of quantity times unit_price', () => {
  render(<Cart items={[
    { product_id: '1', name: 'A', unit_price: 5, quantity: 2 },
    { product_id: '2', name: 'B', unit_price: 3, quantity: 1 }
  ]} onRemove={() => {}} />);
  expect(screen.getByText(/13/)).toBeInTheDocument();
});

test('renders each line item with its name, quantity, and unit_price', () => {
  render(<Cart items={[
    { product_id: '1', name: 'Paracetamol', unit_price: 5, quantity: 2 },
  ]} onRemove={() => {}} />);
  expect(screen.getByText(/Paracetamol/i)).toBeInTheDocument();
  expect(screen.getByText(/2/)).toBeInTheDocument();
  expect(screen.getByText(/5/)).toBeInTheDocument();
});

test('renders zero total for an empty cart', () => {
  render(<Cart items={[]} onRemove={() => {}} />);
  expect(screen.getByText(/0/)).toBeInTheDocument();
});

test('clicking remove calls onRemove with the product_id of that line', () => {
  const onRemove = vi.fn();
  render(<Cart items={[
    { product_id: '1', name: 'A', unit_price: 5, quantity: 2 },
    { product_id: '2', name: 'B', unit_price: 3, quantity: 1 }
  ]} onRemove={onRemove} />);
  const removeButtons = screen.getAllByRole('button', { name: /remove/i });
  fireEvent.click(removeButtons[1]);
  expect(onRemove).toHaveBeenCalledWith('2');
});

test('recomputes total when items change', () => {
  const { rerender } = render(<Cart items={[
    { product_id: '1', name: 'A', unit_price: 5, quantity: 2 },
  ]} onRemove={() => {}} />);
  expect(screen.getByText(/10/)).toBeInTheDocument();

  rerender(<Cart items={[
    { product_id: '1', name: 'A', unit_price: 5, quantity: 2 },
    { product_id: '2', name: 'B', unit_price: 3, quantity: 1 }
  ]} onRemove={() => {}} />);
  expect(screen.getByText(/13/)).toBeInTheDocument();
});
