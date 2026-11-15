-- Runs once, on first container start. Integration + E2E tests use this database
-- so they can wipe tables freely without touching your demo data in "app".
CREATE DATABASE app_test;
