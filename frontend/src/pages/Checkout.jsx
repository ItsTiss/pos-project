import { useEffect, useRef, useState } from 'react';
import Cart from '../components/Cart';
import { getProducts, createSale } from '../api/client';

export default function Checkout() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const latestRequest = useRef(0);

  // Reload the product list whenever the search term changes. Responses can
  // arrive out of order while the cashier types, so only the most recent
  // request is allowed to update the list.
  useEffect(() => {
    const requestId = ++latestRequest.current;
    const term = search.trim();
    (async () => {
      try {
        const list = term ? await getProducts({ search: term }) : await getProducts();
        if (requestId === latestRequest.current) setProducts(list);
      } catch (err) {
        if (requestId === latestRequest.current) setError(err.message);
      }
    })();
  }, [search]);

  function handleAddProduct(product) {
    // Starting a new sale: the previous sale's receipt no longer applies.
    setReceipt(null);
    setCart((current) => {
      const existing = current.find((line) => line.product_id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product_id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.unit_price,
          quantity: 1,
        },
      ];
    });
  }

  function handleRemove(productId) {
    setCart((current) => current.filter((line) => line.product_id !== productId));
  }

  async function handleCompleteSale() {
    setError(null);
    setReceipt(null);
    try {
      const result = await createSale({
        items: cart.map((line) => ({ product_id: line.product_id, quantity: line.quantity })),
      });
      setCart([]);
      setReceipt(result);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Checkout</h1>
      {error && <p role="alert">{error}</p>}
      <div>
        <h2>Products</h2>
        <label htmlFor="product-search">Search products</label>
        <input
          id="product-search"
          type="search"
          placeholder="Name or SKU"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ul>
          {products.map((product) => (
            <li key={product.id}>
              <button type="button" onClick={() => handleAddProduct(product)}>
                {product.name} ({product.sku}) - {product.unit_price}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Cart</h2>
        <Cart items={cart} onRemove={handleRemove} />
        <button type="button" onClick={handleCompleteSale} disabled={cart.length === 0}>
          Complete Sale
        </button>
      </div>
      {receipt && (
        <div>
          <h2>Receipt</h2>
          <p>Sale ID: {receipt.id}</p>
          <p>Total: {receipt.total_amount}</p>
        </div>
      )}
    </div>
  );
}
