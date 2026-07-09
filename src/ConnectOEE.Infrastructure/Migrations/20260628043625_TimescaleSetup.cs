using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations
{
    /// <summary>
    /// Promotes the raw time-series tables to TimescaleDB hypertables and creates a
    /// continuous-aggregate stub. Continuous aggregates and their refresh policies
    /// cannot run inside a transaction, so those statements use suppressTransaction.
    /// ts_counts stores incremental (per-sample) good/reject/total so aggregates sum cleanly.
    /// </summary>
    public partial class TimescaleSetup : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS timescaledb;");

            // Partition the raw tables by time. The PK already includes "TimestampUtc".
            migrationBuilder.Sql(
                "SELECT create_hypertable('ts_counts', 'TimestampUtc', if_not_exists => TRUE, migrate_data => TRUE);");
            migrationBuilder.Sql(
                "SELECT create_hypertable('ts_states', 'TimestampUtc', if_not_exists => TRUE, migrate_data => TRUE);");
            migrationBuilder.Sql(
                "SELECT create_hypertable('ts_speeds', 'TimestampUtc', if_not_exists => TRUE, migrate_data => TRUE);");

            // Hourly production rollup stub. Shift/daily/monthly tiers are added in Phase 7.
            migrationBuilder.Sql(@"
CREATE MATERIALIZED VIEW IF NOT EXISTS oee_counts_hourly
WITH (timescaledb.continuous) AS
SELECT
    ""MachineId"",
    ""LineId"",
    time_bucket(INTERVAL '1 hour', ""TimestampUtc"") AS bucket,
    SUM(""GoodCount"")   AS good_count,
    SUM(""RejectCount"") AS reject_count,
    SUM(""TotalCount"")  AS total_count
FROM ts_counts
GROUP BY ""MachineId"", ""LineId"", bucket
WITH NO DATA;", suppressTransaction: true);

            migrationBuilder.Sql(@"
SELECT add_continuous_aggregate_policy('oee_counts_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);", suppressTransaction: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP MATERIALIZED VIEW IF EXISTS oee_counts_hourly;", suppressTransaction: true);
            // Hypertables revert to plain tables only by dropping; leave the tables intact on down.
        }
    }
}
