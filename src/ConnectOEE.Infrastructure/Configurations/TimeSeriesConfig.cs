using ConnectOEE.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConnectOEE.Infrastructure.Configurations;

/// <summary>
/// Time-series tables use a composite key on (TimestampUtc, MachineId) and map to
/// snake_case table names. The migration promotes them to TimescaleDB hypertables
/// partitioned by TimestampUtc (the partition column must be part of the PK).
/// </summary>
public class TsCountConfig : IEntityTypeConfiguration<TsCount>
{
    public void Configure(EntityTypeBuilder<TsCount> b)
    {
        b.ToTable("ts_counts");
        b.HasKey(x => new { x.TimestampUtc, x.MachineId });
        b.HasIndex(x => new { x.LineId, x.TimestampUtc });
    }
}

public class TsStateConfig : IEntityTypeConfiguration<TsState>
{
    public void Configure(EntityTypeBuilder<TsState> b)
    {
        b.ToTable("ts_states");
        b.HasKey(x => new { x.TimestampUtc, x.MachineId });
        b.HasIndex(x => new { x.LineId, x.TimestampUtc });
    }
}

public class TsSpeedConfig : IEntityTypeConfiguration<TsSpeed>
{
    public void Configure(EntityTypeBuilder<TsSpeed> b)
    {
        b.ToTable("ts_speeds");
        b.HasKey(x => new { x.TimestampUtc, x.MachineId });
        b.HasIndex(x => new { x.LineId, x.TimestampUtc });
    }
}
