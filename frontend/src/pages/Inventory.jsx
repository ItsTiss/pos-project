import { useCallback, useEffect, useState } from 'react';
import ProductForm from '../components/ProductForm';
import { getProducts, createProduct, updateProduct } from '../api/client';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = lowStockOnly ? await getProducts({ lowStock: true }) : await getProducts();
      setProducts(list);
    } catch (err) {
      setError(err.message);
    }
  }, [lowStockOnly]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(data) {
    setError(null);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data);
        setEditingProduct(null);
      } else {
        await createProduct(data);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Inventory</h1>
      {error && <p role="alert">{error}</p>}
      <ProductForm product={editingProduct} onSubmit={handleSubmit} />
      <label>
        <input
          type="checkbox"
          checked={lowStockOnly}
          onChange={(event) => setLowStockOnly(event.target.checked)}
        />
        Show low stock only
      </label>
      {lowStockOnly && products.length === 0 && <p>No products are at or below their low stock threshold.</p>}
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>Unit Price</th>
            <th>Stock Quantity</th>
            <th>Unit</th>
            <th>Low Stock Threshold</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.sku}</td>
              <td>{product.name}</td>
              <td>{product.unit_price}</td>
              <td>{product.stock_quantity}</td>
              <td>{product.unit}</td>
              <td>{product.low_stock_threshold}</td>
              <td>
                <button type="button" onClick={() => setEditingProduct(product)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
