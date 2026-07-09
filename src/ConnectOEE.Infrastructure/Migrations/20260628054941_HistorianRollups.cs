using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <summary>
    /// Phase 7 historian: adds the daily roll-up tier (a hierarchical continuous
    /// aggregate on top of the hourly one), enables native compression on the raw
    /// hypertables, and installs retention/compression policies that map to the
    /// archiving tiers in docs/12 (raw ~90d, hourly ~3y, daily ~5y).
    ///
    /// Continuous-aggregate DDL and policy calls cannot run inside a transaction, so
    /// every statement here uses suppressTransaction.
    /// </summary>
    public partial class HistorianRollups : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ----- Daily roll-up tier (built on the hourly continuous aggregate) -----
            migrationBuilder.Sql(@"
CREATE MATERIALIZED VIEW IF NOT EXISTS oee_counts_daily
WITH (timescaledb.continuous) AS
SELECT
    ""MachineId"",
    ""LineId"",
    time_bucket(INTERVAL '1 day', bucket) AS bucket,
    SUM(good_count)   AS good_count,
    SUM(reject_count) AS reject_count,
    SUM(total_count)  AS total_count
FROM oee_counts_hourly
GROUP BY ""MachineId"", ""LineId"", time_bucket(INTERVAL '1 day', bucket)
WITH NO DATA;", suppressTransaction: true);

            migrationBuilder.Sql(@"
SELECT add_continuous_aggregate_policy('oee_counts_daily',
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);", suppressTransaction: true);

            // ----- Native compression on the raw hypertables -----
            // Segment by machine/line (the common filter) and order newest-first.
            migrationBuilder.Sql(@"
ALTER TABLE ts_counts SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = '""MachineId"",""LineId""',
    timescaledb.compress_orderby   = '""TimestampUtc"" DESC');", suppressTransaction: true);
            migrationBuilder.Sql(@"
ALTER TABLE ts_states SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = '""MachineId"",""LineId""',
    timescaledb.compress_orderby   = '""TimestampUtc"" DESC');", suppressTransaction: true);
            migrationBuilder.Sql(@"
ALTER TABLE ts_speeds SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = '""MachineId"",""LineId""',
    timescaledb.compress_orderby   = '""TimestampUtc"" DESC');", suppressTransaction: true);

            // Compress raw chunks older than 7 days (still queryable, ~10-20x smaller).
            migrationBuilder.Sql("SELECT add_compression_policy('ts_counts', INTERVAL '7 days', if_not_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT add_compression_policy('ts_states', INTERVAL '7 days', if_not_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT add_compression_policy('ts_speeds', INTERVAL '7 days', if_not_exists => TRUE);", suppressTransaction: true);

            // ----- Retention tiers (drop raw early; keep roll-ups long) -----
            migrationBuilder.Sql("SELECT add_retention_policy('ts_counts', INTERVAL '90 days', if_not_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT add_retention_policy('ts_states', INTERVAL '90 days', if_not_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT add_retention_policy('ts_speeds', INTERVAL '90 days', if_not_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT add_retention_policy('oee_counts_hourly', INTERVAL '3 years', if_not_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT add_retention_policy('oee_counts_daily', INTERVAL '5 years', if_not_exists => TRUE);", suppressTransaction: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("SELECT remove_retention_policy('oee_counts_daily', if_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT remove_retention_policy('oee_counts_hourly', if_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT remove_retention_policy('ts_speeds', if_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT remove_retention_policy('ts_states', if_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT remove_retention_policy('ts_counts', if_exists => TRUE);", suppressTransaction: true);

            migrationBuilder.Sql("SELECT remove_compression_policy('ts_speeds', if_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT remove_compression_policy('ts_states', if_exists => TRUE);", suppressTransaction: true);
            migrationBuilder.Sql("SELECT remove_compression_policy('ts_counts', if_exists => TRUE);", suppressTransaction: true);

            migrationBuilder.Sql("DROP MATERIALIZED VIEW IF EXISTS oee_counts_daily;", suppressTransaction: true);
        }
    }
}
