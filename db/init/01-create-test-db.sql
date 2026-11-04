-- Runs once, the first time the Postgres data volume is initialised.
-- Creates the separate database the backend Jest suite runs against, so tests
-- never touch the dev database (pharmacy_pos).
CREATE DATABASE pharmacy_pos_test;
