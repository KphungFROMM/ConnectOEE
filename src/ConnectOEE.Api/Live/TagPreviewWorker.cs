using System.Collections.Concurrent;

using ConnectOEE.Core.Abstractions;

using Microsoft.AspNetCore.SignalR;



namespace ConnectOEE.Api.Live;



/// <summary>Tracks SignalR clients subscribed to live tag value preview for the tag browser.</summary>

public sealed class TagPreviewRegistry

{

    private readonly ConcurrentDictionary<string, TagPreviewSubscription> _subs = new();



    public void Set(string connectionId, Guid plcConnectionId, IReadOnlyList<TagPreviewPath> paths)

        => _subs[connectionId] = new TagPreviewSubscription(plcConnectionId, paths);



    public void Remove(string connectionId) => _subs.TryRemove(connectionId, out _);



    public IReadOnlyList<(string ConnectionId, TagPreviewSubscription Sub)> Snapshot()

        => _subs.Select(kv => (kv.Key, kv.Value)).ToList();



    public sealed record TagPreviewPath(string Path, string? DataType);



    public sealed record TagPreviewSubscription(Guid PlcConnectionId, IReadOnlyList<TagPreviewPath> Paths);

}



/// <summary>Pushes tag preview values over SignalR for subscribed tag-browser clients.</summary>

public class TagPreviewWorker : BackgroundService

{

    private readonly IServiceScopeFactory _scopeFactory;

    private readonly TagPreviewRegistry _registry;

    private readonly IHubContext<LiveHub> _hub;



    public TagPreviewWorker(IServiceScopeFactory scopeFactory, TagPreviewRegistry registry, IHubContext<LiveHub> hub)

    {

        _scopeFactory = scopeFactory;

        _registry = registry;

        _hub = hub;

    }



    protected override async Task ExecuteAsync(CancellationToken stoppingToken)

    {

        while (!stoppingToken.IsCancellationRequested)

        {

            foreach (var (connId, sub) in _registry.Snapshot())

            {

                if (sub.Paths.Count == 0) continue;

                try

                {

                    using var scope = _scopeFactory.CreateScope();

                    var browse = scope.ServiceProvider.GetRequiredService<TagBrowseService>();

                    var requests = sub.Paths

                        .Take(80)

                        .Where(p => !string.IsNullOrWhiteSpace(p.Path))

                        .Select(p => new TagReadRequest(p.Path.Trim(), TagBrowseService.ParseDataType(p.DataType)))

                        .ToArray();

                    if (requests.Length == 0) continue;

                    var values = await browse.ReadValuesAsync(sub.PlcConnectionId, requests, stoppingToken);

                    await _hub.Clients.Client(connId).SendAsync("tagValueUpdate", values, stoppingToken);

                }

                catch (OperationCanceledException) { throw; }

                catch { /* driver offline */ }

            }

            await Task.Delay(2000, stoppingToken);

        }

    }

}

