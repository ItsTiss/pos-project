import { useEffect, useState } from 'react';

const EMPTY_FORM = {
  sku: '',
  name: '',
  unit_price: '',
  stock_quantity: '',
  unit: '',
  low_stock_threshold: '',
};

function toFormValues(product) {
  if (!product) return EMPTY_FORM;
  return {
    sku: product.sku ?? '',
    name: product.name ?? '',
    unit_price: product.unit_price ?? '',
    stock_quantity: product.stock_quantity ?? '',
    unit: product.unit ?? '',
    low_stock_threshold: product.low_stock_threshold ?? '',
  };
}

export default function ProductForm({ product, onSubmit }) {
  const [values, setValues] = useState(() => toFormValues(product));

  useEffect(() => {
    setValues(toFormValues(product));
  }, [product]);

  function handleChange(field) {
    return (event) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    const data = {
      sku: values.sku,
      name: values.name,
      unit_price: values.unit_price === '' ? '' : Number(values.unit_price),
      stock_quantity: values.stock_quantity === '' ? '' : Number(values.stock_quantity),
      unit: values.unit,
      low_stock_threshold:
        values.low_stock_threshold === '' ? '' : Number(values.low_stock_threshold),
    };
    onSubmit(data);
    if (!product) {
      setValues(EMPTY_FORM);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="product-sku">SKU</label>
        <input id="product-sku" value={values.sku} onChange={handleChange('sku')} />
      </div>
      <div>
        <label htmlFor="product-name">Name</label>
        <input id="product-name" value={values.name} onChange={handleChange('name')} />
      </div>
      <div>
        <label htmlFor="product-unit-price">Unit Price</label>
        <input
          id="product-unit-price"
          type="number"
          step="0.01"
          value={values.unit_price}
          onChange={handleChange('unit_price')}
        />
      </div>
      <div>
        <label htmlFor="product-stock-quantity">Stock Quantity</label>
        <input
          id="product-stock-quantity"
          type="number"
          value={values.stock_quantity}
          onChange={handleChange('stock_quantity')}
        />
      </div>
      <div>
        <label htmlFor="product-unit">Unit</label>
        <input id="product-unit" value={values.unit} onChange={handleChange('unit')} />
      </div>
      <div>
        <label htmlFor="product-low-stock-threshold">Low Stock Threshold</label>
        <input
          id="product-low-stock-threshold"
          type="number"
          value={values.low_stock_threshold}
          onChange={handleChange('low_stock_threshold')}
        />
      </div>
      <button type="submit">Save</button>
    </form>
  );
}
