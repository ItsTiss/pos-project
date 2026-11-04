module.exports = {
  testEnvironment: 'node',
  // Refuses to run unless DATABASE_URL points at a *_test database (defaulting
  // to the local pharmacy_pos_test database when unset), then applies
  // migrations to it.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  // Re-checks the database name inside each test file's environment too.
  setupFiles: ['<rootDir>/tests/assertTestDatabase.js'],
  // Test files share tables and DELETE from them in afterEach; run them
  // serially so one file's cleanup can never race another file's assertions.
  maxWorkers: 1,
};
