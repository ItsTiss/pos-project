const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await pool.query(sql);
  }
}

const migrationsPromise = runMigrations();

if (require.main === module) {
  migrationsPromise
    .then(() => {
      console.log('Migrations complete.');
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exitCode = 1;
      return pool.end();
    });
}

module.exports = migrationsPromise;
