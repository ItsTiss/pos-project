const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.message || body.error || 'Request failed');
  }
  return res.json();
}

export async function getProducts({ search, lowStock } = {}) {
  const params = new URLSearchParams();
  if (search !== undefined) params.set('search', search);
  if (lowStock !== undefined) params.set('lowStock', lowStock);
  const query = params.toString();
  const url = `${BASE_URL}/api/products${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  return handleResponse(res);
}

export async function createProduct(data) {
  const res = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateProduct(id, data) {
  const res = await fetch(`${BASE_URL}/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function createSale({ items }) {
  const res = await fetch(`${BASE_URL}/api/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return handleResponse(res);
}
