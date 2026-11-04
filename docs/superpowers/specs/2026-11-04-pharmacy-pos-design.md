# Pharmacy POS — Design Spec (Milestone 1)

Date: 2026-11-04

## Purpose & Context

This is the developer's first full-stack project. It serves two goals at once:

1. **Learning** — a hands-on vehicle for moving from a QA/automation background into development, covering backend, frontend, and database work.
2. **Real use** — it is intended to eventually run as the actual point-of-sale system at the developer's local pharmacy, with a longer-term ambition of becoming a product usable by other pharmacies (single-branch and multi-branch).

Given goal 2, architectural decisions in this spec favor "cheap to grow later" over "fastest possible v1," even though the feature scope of v1 itself stays deliberately small.

## Scope of This Spec

This spec covers **Milestone 1 only**: core checkout + inventory management, no authentication, single terminal, running locally. It is the first of several planned milestones (see Roadmap). Each later milestone gets its own spec when it's designed.

**In scope for Milestone 1:**
- Product/inventory management (create, edit, view, adjust stock)
- Checkout flow (search/select products, build a cart, complete a sale, stock auto-decrements)
- Low-stock visibility
- Local-only running via Docker Compose

**Explicitly out of scope for Milestone 1** (deferred to later milestones, not forgotten):
- Login, authentication, user accounts, roles (Milestone 2)
- Prescription-linked sales, controlled substances, patient records
- Supplier/purchasing and stock receiving workflows
- Multi-terminal concurrency handling, multi-branch data separation
- Cloud deployment
- Receipt printing hardware integration (a receipt is recorded/viewable, not physically printed)

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + Express (REST API) | One language (JS) across backend and frontend halves what a first-time developer needs to learn simultaneously. |
| Database | PostgreSQL | POS data involves money and stock counts — needs real transactions (ACID) and safe concurrent writes. Starting on SQLite would force a rewrite of the data layer exactly when the business depends on it (multi-terminal/multi-branch growth). |
| Frontend | React (Vite), served as a separate app from the API | Keeping frontend and backend as independently deployable pieces is what makes "local now, cloud later" and "single terminal now, multi-terminal later" cheap. The API has no knowledge of who's calling it or from where. |
| Local environment | Docker Compose (Postgres + backend container) | Dev setup mirrors a small production setup from day one. The same containers can later move to a cloud VM or managed Postgres with environment-variable changes only — not an architecture change. |
| Testing | Jest (backend), Vitest + React Testing Library (frontend) | Standard, well-documented choices for a JS stack; pairs with the developer's QA background via test-driven development. |

**Alternative considered and rejected:** Python/Django backend with Django admin for free CRUD screens. Rejected because splitting the first project across Python (backend) and JS (frontend — unavoidable for a real POS UI) doubles the concurrent learning load versus one language end-to-end.

## Architecture

```
┌─────────────────┐       REST (JSON over HTTP)       ┌──────────────────┐
│  React frontend   │ ────────────────────────────────▶ │  Express backend  │
│  (Vite dev server) │ ◀──────────────────────────────── │  (Node.js)        │
└─────────────────┘                                      └──────────────────┘
                                                                   │
                                                                   ▼
                                                          ┌──────────────────┐
                                                          │  PostgreSQL       │
                                                          │  (Docker)         │
                                                          └──────────────────┘
```

- Frontend and backend are two separate folders/apps in one repo (see Project Structure), communicating only over HTTP. No shared runtime state.
- The backend is the only thing that talks to Postgres. The frontend never queries the database directly.
- No authentication layer in Milestone 1: the API is open on the local network. This is acceptable because the system runs only on a trusted local machine/network at this stage, and is explicitly closed before any cloud or multi-user exposure (Milestone 2 gates that).

## Data Model

Two tables for Milestone 1, both carrying fields that anticipate later milestones without implementing them yet:

### `products`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `sku` | text, unique | barcode/SKU lookup |
| `name` | text | |
| `unit_price` | numeric(10,2) | stored in smallest currency unit's decimal form |
| `stock_quantity` | integer | current stock on hand |
| `unit` | text | e.g. "box", "strip", "piece" |
| `low_stock_threshold` | integer | used for low-stock view |
| `branch_id` | UUID, nullable, default fixed value | not used for filtering yet — exists so Milestone-4-style multi-branch doesn't require a schema migration later |
| `created_at`, `updated_at` | timestamptz | |

### `sales`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `total_amount` | numeric(10,2) | |
| `terminal_id` | UUID, nullable, default fixed value | same rationale as `branch_id` above |
| `created_at` | timestamptz | |

### `sale_items`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `sale_id` | UUID, FK → `sales.id` | |
| `product_id` | UUID, FK → `products.id` | |
| `quantity` | integer | |
| `unit_price_at_sale` | numeric(10,2) | price is copied at sale time, not read live from `products`, so later price changes don't rewrite history |

**Why `branch_id`/`terminal_id` exist now but aren't used:** Adding a nullable column with a default later is a cheap migration. Retrofitting every query in the app to filter by branch/terminal after the fact is not. Milestone 1 code can ignore these columns entirely (always one fixed value); a later milestone turns on real filtering.

## Core Flows

**Add/edit a product:** Admin-equivalent screen (no login gate in M1) → form → `POST`/`PUT /api/products` → row created/updated in `products`.

**Checkout:**
1. Cashier searches or scans a product (`GET /api/products?search=...` or by SKU).
2. Adds to an in-memory cart (frontend-only state, not persisted until sale completes).
3. On "complete sale": frontend sends cart contents to `POST /api/sales`.
4. Backend, in a single DB transaction: creates the `sales` row, creates one `sale_items` row per cart line, decrements `stock_quantity` on each `products` row. If any step fails (e.g., insufficient stock), the whole transaction rolls back and the API returns an error — no partial sales, no stock drift.
5. Frontend shows a receipt view (on-screen, not printed) and clears the cart.

**Low stock view:** `GET /api/products?lowStock=true` returns products where `stock_quantity <= low_stock_threshold`.

## Error Handling

- All write endpoints (`POST`/`PUT`) validate input server-side (required fields, non-negative numbers) regardless of frontend validation — the frontend's validation is for UX, the backend's is the actual guard.
- Stock-insufficient and not-found conditions return explicit 4xx responses with a machine-readable error code and human-readable message; the frontend surfaces the message, not a generic failure.
- The sale-creation transaction (step 4 above) is the one place correctness really matters: it must be atomic. This is implemented as a single Postgres transaction, not multiple sequential queries from the application layer.

## Testing Approach

Following test-driven development, leveraging the developer's QA background:

- **Backend:** Jest + a test database (same Postgres, separate schema/db name) for integration tests of each endpoint, plus unit tests for validation logic. Write the test for a given endpoint/behavior before implementing it.
- **Frontend:** Vitest + React Testing Library for component behavior (cart math, form validation) and a handful of flow-level tests (search → add to cart → checkout).
- No end-to-end browser testing in Milestone 1 (e.g. Playwright/Cypress) — deferred until the UI stabilizes past this first milestone, to avoid rework.

## Project Structure

```
pos-project/
├── backend/
│   ├── src/
│   │   ├── routes/        (products, sales)
│   │   ├── db/            (migrations, connection pool)
│   │   └── app.js
│   ├── tests/
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/         (Inventory, Checkout)
│   │   └── main.jsx
│   ├── tests/
│   └── package.json
├── docker-compose.yml
└── docs/
    └── superpowers/specs/   (this file and future milestone specs)
```

## Roadmap Beyond Milestone 1

Each item below becomes its own spec when it's actually designed — listed here only so Milestone 1's data model doesn't paint it into a corner:

- **Milestone 2:** Login page + roles (Admin, Pharmacist at minimum; exact permission set to be defined when this milestone is designed). Adds a `users` table and `created_by`/actor tracking on sales and inventory changes.
- **Later, unordered:** prescription-linked sales (controlled substances, patient records), supplier/purchasing and stock receiving, multi-terminal concurrency, multi-branch data separation, cloud deployment, receipt printing hardware.

## Success Criteria for Milestone 1

- A product can be created, edited, and viewed through the UI, backed by real API calls and Postgres rows.
- A cashier can search for a product, build a cart, complete a sale, and see stock decrement correctly — including when a sale is attempted with insufficient stock (it's rejected, nothing partially commits).
- The low-stock view correctly lists products at or below their threshold.
- The whole stack runs via `docker compose up` plus a frontend dev server, on a machine with nothing pre-installed except Docker and Node.
- Backend endpoints and core frontend cart logic have passing automated tests written before (or alongside, TDD-style) their implementation.
