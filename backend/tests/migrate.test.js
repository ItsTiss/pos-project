const pool = require('../src/db/pool');

beforeAll(async () => {
  require('../src/db/migrate');
});

test('products, sales, sale_items tables exist with expected columns', async () => {
  const res = await pool.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_name IN ('products', 'sales', 'sale_items')
  `);
  const names = res.rows.map(r => `${r.table_name}.${r.column_name}`);
  expect(names).toEqual(expect.arrayContaining([
    'products.sku', 'products.stock_quantity', 'products.low_stock_threshold',
    'sales.total_amount', 'sale_items.unit_price_at_sale'
  ]));
});

afterAll(() => pool.end());
