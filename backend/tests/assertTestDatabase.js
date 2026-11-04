// Safety check for the backend test suite. The tests DELETE every row from
// products/sales/sale_items, so they must never run against anything but a
// dedicated *_test database. Used both as the Jest globalSetup guard and as a
// setupFile (so it also runs inside every test file's environment before
// src/db/pool.js is loaded).
const DEFAULT_TEST_DATABASE_URL = 'postgres://pos:pos@localhost:5432/pharmacy_pos_test';

function assertTestDatabase() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_TEST_DATABASE_URL;
  }

  let dbName;
  try {
    dbName = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ''));
  } catch (err) {
    throw new Error(`Refusing to run tests: DATABASE_URL is not a valid URL (${process.env.DATABASE_URL})`);
  }

  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL points at database "${dbName}", ` +
        'which does not end in "_test". The tests delete all rows, so point ' +
        `DATABASE_URL at a test database (e.g. ${DEFAULT_TEST_DATABASE_URL}).`
    );
  }
}

assertTestDatabase();

module.exports = assertTestDatabase;
module.exports.DEFAULT_TEST_DATABASE_URL = DEFAULT_TEST_DATABASE_URL;
