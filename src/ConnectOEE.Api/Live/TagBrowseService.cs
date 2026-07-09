using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Drivers;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Resolves the right <see cref="ITagBrowsingDriver"/> for a configured PLC connection
/// so the tag browser stays driver-agnostic. The Mock driver supports browsing today;
/// the Rockwell driver (Phase 11) will plug in here. Connections whose driver cannot
/// browse return null and the UI falls back to manual tag entry.
/// </summary>
public class TagBrowseService
{
    private readonly ConnectOeeDbContext _db;
    private readonly ILoggerFactory _loggerFactory;

    public TagBrowseService(ConnectOeeDbContext db, ILoggerFactory loggerFactory)
    {
        _db = db;
        _loggerFactory = loggerFactory;
    }

    public async Task<(DriverType DriverType, ITagBrowsingDriver? Driver)> ResolveAsync(Guid connectionId, CancellationToken ct = default)
    {
        var conn = await _db.PlcConnections.AsNoTracking().FirstOrDefaultAsync(c => c.Id == connectionId, ct);
        if (conn is null) return (DriverType.Mock, null);

        ITagBrowsingDriver? driver = conn.DriverType switch
        {
            DriverType.Mock => new MockDriver(Array.Empty<DriverMachine>()),
            DriverType.RockwellEthernetIp when !string.IsNullOrWhiteSpace(conn.Endpoint) =>
                new RockwellDriver(
                    new RockwellConnectionOptions(conn.Endpoint!.Trim(), conn.Path),
                    Array.Empty<RockwellTagBinding>(),
                    logger: _loggerFactory.CreateLogger<RockwellDriver>()),
            // OPC UA / others gain browsing in later phases.
            _ => null,
        };
        return (conn.DriverType, driver);
    }

    public static TagDataType ParseDataType(string? value)
        => Enum.TryParse<TagDataType>(value, true, out var dt) ? dt : TagDataType.Unknown;

    public async Task<IReadOnlyList<TagValueSample>> ReadValuesAsync(
        Guid connectionId,
        IReadOnlyList<TagReadRequest> requests,
        CancellationToken ct = default)
    {
        var (_, driver) = await ResolveAsync(connectionId, ct);
        if (driver is null || requests.Count == 0) return Array.Empty<TagValueSample>();
        return await driver.ReadValuesAsync(requests, ct);
    }
}
