-- Runs once on first database creation (empty data dir).
-- Enables the TimescaleDB extension so EF migrations can create hypertables.
CREATE EXTENSION IF NOT EXISTS timescaledb;
