-- Separate database for automated tests (never the dev DB).
-- Runs once, on first initialization of the postgres data volume.
-- For an already-initialized volume run:
--   docker exec family-budget-db psql -U budget -d postgres -c 'CREATE DATABASE family_budget_test'
SELECT 'CREATE DATABASE family_budget_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'family_budget_test')\gexec
