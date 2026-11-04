# Pharmacy POS (sandbox) - Milestone 1

Checkout and inventory for a single pharmacy branch.

- `backend/` - Node/Express REST API on PostgreSQL (port 3001)
- `frontend/` - React + Vite single-page app (port 5173)
- `db/init/` - SQL run by Postgres the first time its data volume is created

You need Docker (with Compose) and Node 20+.

## Start the stack

```sh
docker compose up --build
```

This starts:

- `db`: Postgres 16 on `localhost:5432` (user `pos`, password `pos`). The dev
  database is `pharmacy_pos`. On a fresh volume, `db/init/01-create-test-db.sql`
  also creates `pharmacy_pos_test` for the backend tests.
- `backend`: waits for the database healthcheck to pass, runs the migrations
  (`npm run migrate`, safe to repeat), then serves the API on
  `http://localhost:3001` (`GET /api/health` returns `{"status":"ok"}`).

### Start the frontend dev server

In another terminal:

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The app calls the API at `http://localhost:3001`.
To use a different API address, set `VITE_API_URL`.

### CORS_ORIGIN

The browser loads the frontend from one origin (`http://localhost:5173`) and
calls the API on another (`http://localhost:3001`), so the backend sends CORS
headers. Only one origin is allowed. It comes from the `CORS_ORIGIN`
environment variable and defaults to `http://localhost:5173`. If you serve
the frontend somewhere else, set it before you start the stack:

```sh
CORS_ORIGIN=http://localhost:4173 docker compose up
```

## Run the tests

### Backend (Jest + Supertest, needs the `db` container running)

The backend tests delete every row from `products`, `sales` and `sale_items`,
so they run against a separate database called `pharmacy_pos_test`, never
the dev database.

```sh
docker compose up -d db
cd backend
npm install
npm test
```

`npm test` reads `DATABASE_URL`. If it is unset, it uses
`postgres://pos:pos@localhost:5432/pharmacy_pos_test`. Before any test runs, a
Jest `globalSetup` (`backend/tests/globalSetup.js`) checks that the database
name ends in `_test` and stops the run if it does not, then applies the
migrations to that database. If you set `DATABASE_URL` yourself, it must point
at a `*_test` database:

```sh
DATABASE_URL=postgres://pos:pos@localhost:5432/pharmacy_pos_test npm test
```

Test files run one at a time (`maxWorkers: 1` in `backend/jest.config.js`)
because they share tables.

**Existing volumes:** Postgres runs `db/init/` only when it creates a new data
volume. If your `db_data` volume is older than that script, create the test
database once by hand:

```sh
docker compose exec db createdb -U pos pharmacy_pos_test
```

### Frontend (Vitest + React Testing Library, needs no running services)

```sh
cd frontend
npm install
npm test
```
