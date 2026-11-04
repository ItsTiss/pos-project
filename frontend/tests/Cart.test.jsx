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

test('total is a clean 2-decimal figure, without floating-point artifacts', () => {
  // 1.1 * 3 === 3.3000000000000003 in plain JS float math.
  render(<Cart items={[
    { product_id: '1', name: 'A', unit_price: 1.1, quantity: 3 },
  ]} onRemove={() => {}} />);
  expect(screen.getByText('Total: 3.30')).toBeInTheDocument();
});

test('handles string-typed unit_price exactly as the real API returns it', () => {
  // The backend serialises NUMERIC(10,2) columns as strings like "1.10";
  // they must be coerced to numbers, not string-concatenated.
  render(<Cart items={[
    { product_id: '1', name: 'A', unit_price: '1.10', quantity: 3 },
    { product_id: '2', name: 'B', unit_price: '0.10', quantity: 1 },
    { product_id: '3', name: 'C', unit_price: '0.20', quantity: 1 },
  ]} onRemove={() => {}} />);
  expect(screen.getByText('Total: 3.60')).toBeInTheDocument();
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
