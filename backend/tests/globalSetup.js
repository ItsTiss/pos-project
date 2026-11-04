module.exports = async () => {
  // Throws (aborting the whole run) unless DATABASE_URL names a *_test database.
  require('./assertTestDatabase');

  // Apply migrations to the test database before any test file runs.
  const migrations = require('../src/db/migrate');
  const pool = require('../src/db/pool');
  try {
    await migrations;
  } finally {
    await pool.end();
  }
};
