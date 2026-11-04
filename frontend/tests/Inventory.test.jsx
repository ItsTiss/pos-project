// frontend/tests/Inventory.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, test, expect } from 'vitest';
import Inventory from '../src/pages/Inventory';
import * as client from '../src/api/client';

test('submitting the form calls createProduct and refreshes the list', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([]);
  vi.spyOn(client, 'createProduct').mockResolvedValue({ id: '1', sku: 'ABC', name: 'Test' });
  render(<Inventory />);
  fireEvent.change(screen.getByLabelText(/sku/i), { target: { value: 'ABC' } });
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(client.createProduct).toHaveBeenCalled());
});
