export default function Cart({ items, onRemove }) {
  // The API returns NUMERIC columns as strings (e.g. "1.10"), so coerce
  // explicitly, and sum in integer cents to avoid float artifacts such as
  // 3.3000000000000003.
  const totalCents = items.reduce(
    (sum, item) => sum + Math.round(Number(item.unit_price) * 100) * Number(item.quantity),
    0
  );
  const total = (totalCents / 100).toFixed(2);

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.product_id}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit_price}</td>
              <td>
                <button type="button" onClick={() => onRemove(item.product_id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Total: {total}</p>
    </div>
  );
}
