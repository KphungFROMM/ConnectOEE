using System.Collections.Concurrent;

namespace ConnectOEE.Api.Live;

/// <summary>In-memory active browser tab / kiosk presence (heartbeat-driven).</summary>
public sealed class ClientPresenceRegistry
{
    private static readonly TimeSpan StaleAfter = TimeSpan.FromSeconds(90);
    private readonly ConcurrentDictionary<Guid, ClientPresence> _sessions = new();

    public void Touch(ClientPresence presence)
    {
        var now = DateTimeOffset.UtcNow;
        _sessions.AddOrUpdate(
            presence.SessionId,
            _ =>
            {
                presence.ConnectedUtc = now;
                presence.LastSeenUtc = now;
                return presence;
            },
            (_, existing) =>
            {
                existing.ClientKind = presence.ClientKind;
                existing.UserId = presence.UserId;
                existing.UserName = presence.UserName;
                existing.DisplayName = presence.DisplayName;
                existing.Route = presence.Route;
                existing.PageLabel = presence.PageLabel;
                existing.Theme = presence.Theme;
                existing.KioskDashboardId = presence.KioskDashboardId;
                existing.KioskDashboardName = presence.KioskDashboardName;
                existing.LineId = presence.LineId;
                existing.LineName = presence.LineName;
                existing.LastSeenUtc = now;
                return existing;
            });
    }

    public void Remove(Guid sessionId) => _sessions.TryRemove(sessionId, out _);

    public IReadOnlyList<ClientPresence> ActiveSessions()
    {
        PurgeStale();
        return _sessions.Values
            .OrderByDescending(s => s.LastSeenUtc)
            .ToList();
    }

    private void PurgeStale()
    {
        var cutoff = DateTimeOffset.UtcNow - StaleAfter;
        foreach (var kv in _sessions)
        {
            if (kv.Value.LastSeenUtc < cutoff)
                _sessions.TryRemove(kv.Key, out _);
        }
    }
}

public sealed class ClientPresence
{
    public Guid SessionId { get; set; }
    public string ClientKind { get; set; } = "Staff";
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public string? DisplayName { get; set; }
    public string? Route { get; set; }
    public string? PageLabel { get; set; }
    public string? Theme { get; set; }
    public Guid? KioskDashboardId { get; set; }
    public string? KioskDashboardName { get; set; }
    public Guid? LineId { get; set; }
    public string? LineName { get; set; }
    public DateTimeOffset ConnectedUtc { get; set; }
    public DateTimeOffset LastSeenUtc { get; set; }
}

/// <summary>Tracks open SignalR connections on <see cref="LiveHub"/>.</summary>
public sealed class LiveHubConnectionCounter
{
    private int _count;

    public int ConnectionCount => Volatile.Read(ref _count);

    public void Connected() => Interlocked.Increment(ref _count);

    public void Disconnected() => Interlocked.Decrement(ref _count);
}
