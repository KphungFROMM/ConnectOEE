using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConnectOEE.Infrastructure.Migrations;

/// <summary>OEE continuous aggregates (hourly/shift/daily/monthly) per docs/04-data-model.md.</summary>
public partial class OeeHistorianRollups : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
CREATE MATERIALIZED VIEW IF NOT EXISTS oee_hourly
WITH (timescaledb.continuous) AS
SELECT
    ""MachineId"",
    ""LineId"",
    time_bucket(INTERVAL '1 hour', ""TimestampUtc"") AS bucket,
    AVG(CASE WHEN ""State"" = 1 THEN 1.0 ELSE 0.0 END) * 100 AS availability_pct,
    SUM(""GoodCount"") AS good_count,
    SUM(""RejectCount"") AS reject_count
FROM ts_counts c
LEFT JOIN ts_states s ON s.""MachineId"" = c.""MachineId"" AND s.""TimestampUtc"" = c.""TimestampUtc""
GROUP BY ""MachineId"", ""LineId"", time_bucket(INTERVAL '1 hour', ""TimestampUtc"")
WITH NO DATA;", suppressTransaction: true);

        migrationBuilder.Sql(@"
SELECT add_continuous_aggregate_policy('oee_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);", suppressTransaction: true);

        migrationBuilder.Sql(@"
CREATE MATERIALIZED VIEW IF NOT EXISTS oee_daily
WITH (timescaledb.continuous) AS
SELECT
    ""MachineId"",
    ""LineId"",
    time_bucket(INTERVAL '1 day', bucket) AS bucket,
    AVG(availability_pct) AS availability_pct,
    SUM(good_count) AS good_count,
    SUM(reject_count) AS reject_count
FROM oee_hourly
GROUP BY ""MachineId"", ""LineId"", time_bucket(INTERVAL '1 day', bucket)
WITH NO DATA;", suppressTransaction: true);

        migrationBuilder.Sql(@"
SELECT add_continuous_aggregate_policy('oee_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);", suppressTransaction: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP MATERIALIZED VIEW IF EXISTS oee_daily CASCADE;", suppressTransaction: true);
        migrationBuilder.Sql("DROP MATERIALIZED VIEW IF EXISTS oee_hourly CASCADE;", suppressTransaction: true);
    }
}
