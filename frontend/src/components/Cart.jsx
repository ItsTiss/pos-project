export default function Cart({ items, onRemove }) {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

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
