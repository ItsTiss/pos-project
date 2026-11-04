# Pharmacy POS Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally-running checkout + inventory system: products can be managed, sales can be completed through a cart, and stock decrements correctly and atomically — with no authentication yet.

**Architecture:** Two independent apps in one repo — an Express REST API backed by PostgreSQL (`backend/`), and a React/Vite frontend (`frontend/`) that talks to it only over HTTP. Postgres and the backend run via Docker Compose; the frontend runs via its own dev server.

**Tech Stack:** Node.js, Express, `pg` (node-postgres), PostgreSQL 16, React 18 (Vite), Jest + Supertest (backend tests), Vitest + React Testing Library (frontend tests), Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-04-pharmacy-pos-design.md`

## Global Constraints

- Backend: Node.js + Express, REST API only — no server-rendered HTML.
- Database: PostgreSQL only (not SQLite), accessed only from the backend.
- Frontend: React (Vite), a separate app from the backend, communicating only via HTTP/JSON.
- Local dev: Postgres + backend run via Docker Compose; frontend runs via its own dev server.
- No authentication, no user accounts, no roles in this milestone.
- `products.branch_id` and `sales.terminal_id` columns exist but are always written as a single fixed default value in this milestone — no filtering logic reads them.
- `sale_items.unit_price_at_sale` is copied from the product at sale time and never re-read from `products` afterward.
- Sale creation (insert sale, insert sale items, decrement stock) is one atomic Postgres transaction — no partial sales on failure.
- Backend tests: Jest + Supertest, written before implementation (TDD). Frontend tests: Vitest + React Testing Library.
- Receipts are shown on-screen only — no printer integration.

## Review Focus

- Sale request where a line item's quantity exceeds current `stock_quantity`: the whole sale must be rejected and no stock/rows changed for any line in that sale — tested in Task 4.
- Product created with a `sku` that already exists: must be rejected with a clear error, not a silent duplicate row — tested in Task 3.
- Product created or edited with a negative or zero `unit_price` or negative `stock_quantity`: must be rejected by the backend regardless of frontend input — tested in Task 3.
- Sale request with an empty cart (no line items): must be rejected rather than creating an empty sale record — tested in Task 4.
- Low-stock query boundary where `stock_quantity` exactly equals `low_stock_threshold`: must be included in the low-stock result (spec uses `<=`) — tested in Task 3.

---

## File Structure

```
pos-project/
├── docker-compose.yml
├── backend/
│   ├── package.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── app.js                 (Express app, no listen)
│   │   ├── server.js              (listen, imports app)
│   │   ├── db/
│   │   │   ├── pool.js            (pg Pool, reads env vars)
│   │   │   └── migrate.js         (runs .sql files in migrations/ in order)
│   │   ├── migrations/
│   │   │   ├── 001_create_products.sql
│   │   │   ├── 002_create_sales.sql
│   │   │   └── 003_create_sale_items.sql
│   │   └── routes/
│   │       ├── products.js
│   │       └── sales.js
│   └── tests/
│       ├── products.test.js
│       └── sales.test.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx                (routes between Inventory and Checkout pages)
    │   ├── api/
    │   │   └── client.js          (fetch wrapper: getProducts, createProduct, updateProduct, createSale)
    │   ├── pages/
    │   │   ├── Inventory.jsx
    │   │   └── Checkout.jsx
    │   └── components/
    │       ├── ProductForm.jsx
    │       └── Cart.jsx
    └── tests/
        ├── Cart.test.jsx
        └── Checkout.test.jsx
```

---

### Task 1: Project scaffolding, Docker Compose, Postgres connectivity

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/package.json`
- Create: `backend/Dockerfile`
- Create: `backend/src/app.js`
- Create: `backend/src/server.js`
- Create: `backend/src/db/pool.js`
- Test: `backend/tests/health.test.js`

**Interfaces:**
- Produces: `app.js` exports an Express `app` (default export) with `GET /api/health` returning `{ status: "ok" }`. `pool.js` exports a singleton `pg.Pool` instance (default export) configured from `DATABASE_URL` env var.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/health.test.js
const request = require('supertest');
const app = require('../src/app');

test('GET /api/health returns ok status', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest health.test.js`
Expected: FAIL (`Cannot find module '../src/app'`)

- [ ] **Step 3: Create `backend/package.json`, install dependencies**

Dependencies: `express`, `pg`. Dev dependencies: `jest`, `supertest`.
Add npm scripts: `"test": "jest"`, `"start": "node src/server.js"`, `"migrate": "node src/db/migrate.js"`.

- [ ] **Step 4: Implement `backend/src/app.js`**

Express app with `express.json()` middleware and a `GET /api/health` route returning `{ status: 'ok' }`. Export the app (not listening).

- [ ] **Step 5: Implement `backend/src/server.js`**

Imports `app` from `./app`, calls `app.listen(process.env.PORT || 3001)`.

- [ ] **Step 6: Implement `backend/src/db/pool.js`**

Exports `new Pool({ connectionString: process.env.DATABASE_URL })` from the `pg` package.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend && npx jest health.test.js`
Expected: PASS

- [ ] **Step 8: Create `backend/Dockerfile`**

Node 20-alpine base image, copies `package.json`/`package-lock.json`, runs `npm install`, copies source, `CMD ["node", "src/server.js"]`.

- [ ] **Step 9: Create root `docker-compose.yml`**

Two services: `db` (image `postgres:16`, env `POSTGRES_DB=pharmacy_pos`, `POSTGRES_USER=pos`, `POSTGRES_PASSWORD=pos`, port `5432:5432`, named volume for data) and `backend` (build from `./backend`, port `3001:3001`, `DATABASE_URL=postgres://pos:pos@db:5432/pharmacy_pos`, `depends_on: [db]`).

- [ ] **Step 10: Verify the stack starts**

Run: `docker compose up -d && curl http://localhost:3001/api/health`
Expected: `{"status":"ok"}`

- [ ] **Step 11: Commit**

```bash
git add docker-compose.yml backend/
git commit -m "feat: scaffold backend, Docker Compose, health check"
```

---

### Task 2: Database schema migrations

**Files:**
- Create: `backend/src/migrations/001_create_products.sql`
- Create: `backend/src/migrations/002_create_sales.sql`
- Create: `backend/src/migrations/003_create_sale_items.sql`
- Create: `backend/src/db/migrate.js`
- Test: `backend/tests/migrate.test.js`

**Interfaces:**
- Consumes: `pool.js` default export (Task 1).
- Produces: running `node src/db/migrate.js` creates `products`, `sales`, `sale_items` tables matching the spec's Data Model section exactly (columns, types, FKs, defaults below). Later tasks query these tables through `pool`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/migrate.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest migrate.test.js`
Expected: FAIL (tables do not exist / module not found)

- [ ] **Step 3: Write `001_create_products.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price > 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  unit TEXT NOT NULL,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  branch_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Write `002_create_sales.sql`**

```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount > 0),
  terminal_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 5: Write `003_create_sale_items.sql`**

```sql
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_at_sale NUMERIC(10,2) NOT NULL
);
```

- [ ] **Step 6: Implement `backend/src/db/migrate.js`**

Reads all `.sql` files in `src/migrations/` sorted by filename, runs each via `pool.query(sql)` in order, wrapped so re-running is safe (use `CREATE TABLE IF NOT EXISTS` in each file instead of bare `CREATE TABLE`).

- [ ] **Step 7: Run migration against the Docker Postgres, then run test**

Run: `docker compose exec backend npm run migrate` then `cd backend && npx jest migrate.test.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/migrations backend/src/db/migrate.js backend/tests/migrate.test.js
git commit -m "feat: add products/sales/sale_items schema migrations"
```

---

### Task 3: Products API (CRUD, search, low-stock)

**Files:**
- Create: `backend/src/routes/products.js`
- Modify: `backend/src/app.js` (mount `/api/products` router)
- Test: `backend/tests/products.test.js`

**Interfaces:**
- Consumes: `pool.js` (Task 1), `products` table (Task 2).
- Produces: Router with:
  - `GET /api/products?search=<text>&lowStock=true` → 200, array of product rows
  - `POST /api/products` body `{ sku, name, unit_price, stock_quantity, unit, low_stock_threshold }` → 201, created row
  - `PUT /api/products/:id` same body shape → 200, updated row, or 404 if not found
  Later tasks (frontend) call these exact routes/shapes.

- [ ] **Step 1: Write failing tests for create, validation, duplicate SKU, search, low-stock boundary**

```js
// backend/tests/products.test.js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db/pool');

afterEach(() => pool.query('DELETE FROM products'));
afterAll(() => pool.end());

test('POST /api/products creates a product', async () => {
  const res = await request(app).post('/api/products').send({
    sku: 'ABC123', name: 'Paracetamol', unit_price: 5.50,
    stock_quantity: 100, unit: 'box', low_stock_threshold: 10
  });
  expect(res.status).toBe(201);
  expect(res.body.sku).toBe('ABC123');
});

test('POST /api/products rejects duplicate sku', async () => {
  const body = { sku: 'DUP1', name: 'X', unit_price: 1, stock_quantity: 1, unit: 'box', low_stock_threshold: 1 };
  await request(app).post('/api/products').send(body);
  const res = await request(app).post('/api/products').send(body);
  expect(res.status).toBe(409);
});

test('POST /api/products rejects non-positive unit_price', async () => {
  const res = await request(app).post('/api/products').send({
    sku: 'NEG1', name: 'X', unit_price: 0, stock_quantity: 1, unit: 'box', low_stock_threshold: 1
  });
  expect(res.status).toBe(400);
});

test('POST /api/products rejects negative stock_quantity', async () => {
  const res = await request(app).post('/api/products').send({
    sku: 'NEG2', name: 'X', unit_price: 1, stock_quantity: -1, unit: 'box', low_stock_threshold: 1
  });
  expect(res.status).toBe(400);
});

test('GET /api/products?lowStock=true includes products where stock_quantity equals threshold', async () => {
  await request(app).post('/api/products').send({
    sku: 'LOW1', name: 'EdgeCase', unit_price: 1, stock_quantity: 5, unit: 'box', low_stock_threshold: 5
  });
  const res = await request(app).get('/api/products?lowStock=true');
  expect(res.body.some(p => p.sku === 'LOW1')).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest products.test.js`
Expected: FAIL (route not found / 404s)

- [ ] **Step 3: Implement `backend/src/routes/products.js`**

- `POST /`: validate `unit_price > 0` and `stock_quantity >= 0` in JS before querying (return 400 with `{ error: 'invalid_input', message }` if not); insert; catch unique-violation Postgres error code `23505` on `sku` and return 409 `{ error: 'duplicate_sku', message }`.
- `GET /`: build query filtering `name ILIKE` or `sku ILIKE` on `search` param when present; add `WHERE stock_quantity <= low_stock_threshold` when `lowStock=true`.
- `PUT /:id`: same validation as POST, `UPDATE ... WHERE id = $1 RETURNING *`, 404 if no row returned.

- [ ] **Step 4: Mount router in `backend/src/app.js`**

`app.use('/api/products', require('./routes/products'))`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest products.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/products.js backend/src/app.js backend/tests/products.test.js
git commit -m "feat: add products API with validation, search, low-stock filter"
```

---

### Task 4: Sales API (atomic checkout transaction)

**Files:**
- Create: `backend/src/routes/sales.js`
- Modify: `backend/src/app.js` (mount `/api/sales` router)
- Test: `backend/tests/sales.test.js`

**Interfaces:**
- Consumes: `pool.js` (Task 1); `products`, `sales`, `sale_items` tables (Task 2).
- Produces: `POST /api/sales` body `{ items: [{ product_id, quantity }, ...] }` → 201 `{ id, total_amount, items: [...] }` on success; 400 on empty `items`; 409 `{ error: 'insufficient_stock', product_id }` if any line's quantity exceeds current stock, with no rows changed.

- [ ] **Step 1: Write failing tests for successful sale, stock decrement, insufficient stock rollback, empty cart**

```js
// backend/tests/sales.test.js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db/pool');

async function createProduct(overrides = {}) {
  const res = await request(app).post('/api/products').send({
    sku: `SKU${Date.now()}${Math.random()}`, name: 'Test', unit_price: 10,
    stock_quantity: 5, unit: 'box', low_stock_threshold: 1, ...overrides
  });
  return res.body;
}

afterEach(() => pool.query('DELETE FROM sale_items; DELETE FROM sales; DELETE FROM products'));
afterAll(() => pool.end());

test('POST /api/sales completes a sale and decrements stock', async () => {
  const product = await createProduct({ stock_quantity: 5 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: 2 }]
  });
  expect(res.status).toBe(201);
  expect(res.body.total_amount).toBe('20.00');
  const check = await request(app).get('/api/products');
  const updated = check.body.find(p => p.id === product.id);
  expect(updated.stock_quantity).toBe(3);
});

test('POST /api/sales rejects and rolls back when quantity exceeds stock', async () => {
  const product = await createProduct({ stock_quantity: 1 });
  const res = await request(app).post('/api/sales').send({
    items: [{ product_id: product.id, quantity: 5 }]
  });
  expect(res.status).toBe(409);
  const check = await request(app).get('/api/products');
  const unchanged = check.body.find(p => p.id === product.id);
  expect(unchanged.stock_quantity).toBe(1);
  const sales = await pool.query('SELECT * FROM sales');
  expect(sales.rows.length).toBe(0);
});

test('POST /api/sales rejects an empty cart', async () => {
  const res = await request(app).post('/api/sales').send({ items: [] });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest sales.test.js`
Expected: FAIL (route not found)

- [ ] **Step 3: Implement `backend/src/routes/sales.js`**

`POST /`: return 400 if `items` missing or empty. Otherwise, within a single `pool.connect()` client transaction (`BEGIN` / `COMMIT` / `ROLLBACK`):
  1. For each item, `SELECT unit_price, stock_quantity FROM products WHERE id = $1 FOR UPDATE`.
  2. If `stock_quantity < quantity`, `ROLLBACK` and respond 409 `{ error: 'insufficient_stock', product_id }`.
  3. Sum `unit_price * quantity` across items for `total_amount`.
  4. `INSERT INTO sales (total_amount) VALUES ($1) RETURNING id`.
  5. For each item, `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_at_sale) VALUES (...)` and `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`.
  6. `COMMIT`, respond 201 with the sale and items.
Release the client in a `finally` block regardless of outcome.

- [ ] **Step 4: Mount router in `backend/src/app.js`**

`app.use('/api/sales', require('./routes/sales'))`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest sales.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/sales.js backend/src/app.js backend/tests/sales.test.js
git commit -m "feat: add atomic sales API with stock-aware transaction"
```

---

### Task 5: Frontend scaffolding and API client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/api/client.js`
- Test: `frontend/tests/client.test.js`

**Interfaces:**
- Produces: `client.js` exports `getProducts({ search, lowStock } = {})`, `createProduct(data)`, `updateProduct(id, data)`, `createSale({ items })` — each returns a Promise resolving to the parsed JSON body, and throws an `Error` with the API's `message` on a non-2xx response. `App.jsx` default-exports a component rendering a simple nav between `/inventory` and `/checkout` (React Router).

- [ ] **Step 1: Write the failing test**

```js
// frontend/tests/client.test.js
import { describe, test, expect, vi, afterEach } from 'vitest';
import { getProducts, createSale } from '../src/api/client';

afterEach(() => vi.restoreAllMocks());

test('getProducts calls the products endpoint and returns parsed JSON', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: '1' }] });
  const result = await getProducts({ search: 'abc' });
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/products?search=abc'));
  expect(result).toEqual([{ id: '1' }]);
});

test('createSale throws with API message on failure', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'insufficient stock' }) });
  await expect(createSale({ items: [] })).rejects.toThrow('insufficient stock');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/client.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `frontend/package.json`, install dependencies**

Dependencies: `react`, `react-dom`, `react-router-dom`. Dev dependencies: `vite`, `@vitejs/plugin-react`, `vitest`, `@testing-library/react`, `jsdom`.

- [ ] **Step 4: Implement `frontend/src/api/client.js`**

`const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'`. Each function builds the URL/query string, calls `fetch`, and on `!res.ok` throws `new Error((await res.json()).message)`; otherwise returns `res.json()`.

- [ ] **Step 5: Implement `frontend/src/App.jsx` and `frontend/src/main.jsx`**

`App.jsx`: `BrowserRouter` with routes `/inventory` → `Inventory`, `/checkout` → `Checkout` (stub components created in Tasks 6-7; use placeholder `<div/>` here only if those tasks haven't run yet — otherwise import real ones). `main.jsx`: mounts `<App />` into `#root`.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/client.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with API client"
```

---

### Task 6: Inventory page

**Files:**
- Create: `frontend/src/pages/Inventory.jsx`
- Create: `frontend/src/components/ProductForm.jsx`
- Test: `frontend/tests/Inventory.test.jsx`

**Interfaces:**
- Consumes: `getProducts`, `createProduct`, `updateProduct` from `../api/client` (Task 5).
- Produces: `Inventory` default export — a page component with no required props, rendering a product list and a form; used by `App.jsx` routing (Task 5).

- [ ] **Step 1: Write the failing test**

```jsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/Inventory.test.jsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `frontend/src/components/ProductForm.jsx`**

Controlled form with labeled inputs for `sku`, `name`, `unit_price`, `stock_quantity`, `unit`, `low_stock_threshold`, a "Save" submit button, calling an `onSubmit(data)` prop with the form values.

- [ ] **Step 4: Implement `frontend/src/pages/Inventory.jsx`**

On mount, calls `getProducts()` and stores the list in state. Renders the list and a `ProductForm` whose `onSubmit` calls `createProduct(data)` then re-fetches the list.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/Inventory.test.jsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Inventory.jsx frontend/src/components/ProductForm.jsx frontend/tests/Inventory.test.jsx
git commit -m "feat: add inventory page with product create flow"
```

---

### Task 7: Checkout page (cart + sale completion)

**Files:**
- Create: `frontend/src/pages/Checkout.jsx`
- Create: `frontend/src/components/Cart.jsx`
- Test: `frontend/tests/Cart.test.jsx`
- Test: `frontend/tests/Checkout.test.jsx`

**Interfaces:**
- Consumes: `getProducts`, `createSale` from `../api/client` (Task 5).
- Produces: `Cart` default export — props `{ items, onRemove }`, renders line items and a total computed from `quantity * unit_price` per line. `Checkout` default export — page component, no required props, used by `App.jsx` routing (Task 5).

- [ ] **Step 1: Write the failing test for Cart total math**

```jsx
// frontend/tests/Cart.test.jsx
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import Cart from '../src/components/Cart';

test('renders total as the sum of quantity times unit_price', () => {
  render(<Cart items={[
    { product_id: '1', name: 'A', unit_price: 5, quantity: 2 },
    { product_id: '2', name: 'B', unit_price: 3, quantity: 1 }
  ]} onRemove={() => {}} />);
  expect(screen.getByText(/13/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Write the failing test for completing a sale**

```jsx
// frontend/tests/Checkout.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, test, expect } from 'vitest';
import Checkout from '../src/pages/Checkout';
import * as client from '../src/api/client';

test('completing a sale calls createSale with cart items and shows a receipt', async () => {
  vi.spyOn(client, 'getProducts').mockResolvedValue([
    { id: '1', sku: 'A1', name: 'Paracetamol', unit_price: 5, stock_quantity: 10 }
  ]);
  vi.spyOn(client, 'createSale').mockResolvedValue({ id: 's1', total_amount: '5.00', items: [] });
  render(<Checkout />);
  fireEvent.click(await screen.findByText(/Paracetamol/i));
  fireEvent.click(screen.getByRole('button', { name: /complete sale/i }));
  await waitFor(() => expect(client.createSale).toHaveBeenCalledWith({ items: [{ product_id: '1', quantity: 1 }] }));
  expect(await screen.findByText(/5\.00/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npx vitest run tests/Cart.test.jsx tests/Checkout.test.jsx`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement `frontend/src/components/Cart.jsx`**

Renders each item (`name`, `quantity`, `unit_price`), a remove button per line calling `onRemove(product_id)`, and the sum of `quantity * unit_price` across items.

- [ ] **Step 5: Implement `frontend/src/pages/Checkout.jsx`**

On mount, calls `getProducts()` for the searchable list. Clicking a product adds `{ product_id, quantity: 1 }` to local cart state (increment quantity if already present). Renders `Cart` with the current items. "Complete Sale" button calls `createSale({ items: cart })`; on success, clears the cart and displays the returned `total_amount` and `id` as an on-screen receipt; on failure (e.g. insufficient stock), displays the thrown error's message instead of clearing the cart.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run tests/Cart.test.jsx tests/Checkout.test.jsx`
Expected: PASS

- [ ] **Step 7: Wire real pages into `App.jsx`**

Replace any placeholder routes from Task 5 with the real `Inventory` and `Checkout` imports.

- [ ] **Step 8: Manual end-to-end smoke check**

Run: `docker compose up -d` (backend+db), `cd frontend && npm run dev`, open the app, create a product on `/inventory`, complete a sale on `/checkout`, confirm stock decremented on `/inventory`.

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: add checkout page with cart and sale completion"
```
