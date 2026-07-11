using ConnectOEE.Api.Auth;
using ConnectOEE.Core.Entities.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Real-time hub. Clients subscribe to a line group and receive "liveUpdate"
/// snapshots. Hub groups keep kiosks/dashboards receiving only what they render.
/// </summary>
[Authorize]
public class LiveHub : Hub
{
    public static string LineGroup(Guid lineId) => $"line:{lineId}";
    public static string BrowseGroup(Guid plcConnectionId) => $"browse:{plcConnectionId}";

    public async Task SubscribeLine(Guid lineId)
    {
        var scope = Context.GetHttpContext()?.RequestServices.GetRequiredService<IScopeAccessService>();
        if (scope is null || !await scope.CanAccessLineAsync(Context.User!, lineId))
            throw new HubException("Forbidden: line out of scope");

        await Groups.AddToGroupAsync(Context.ConnectionId, LineGroup(lineId));
    }

    public Task UnsubscribeLine(Guid lineId)
        => Groups.RemoveFromGroupAsync(Context.ConnectionId, LineGroup(lineId));

    public Task SubscribeTagBrowse(Guid plcConnectionId)
    {
        var user = Context.User;
        if (user is null || !user.HasClaim(ConnectClaimTypes.Permission, PermissionKeys.BrowseTags))
            throw new HubException("Forbidden: tags.browse permission required");

        return Groups.AddToGroupAsync(Context.ConnectionId, BrowseGroup(plcConnectionId));
    }

    public Task UnsubscribeTagBrowse(Guid plcConnectionId)
        => Groups.RemoveFromGroupAsync(Context.ConnectionId, BrowseGroup(plcConnectionId));

    public Task SubscribeTagPreview(Guid plcConnectionId, TagPreviewPathDto[] paths)
    {
        var user = Context.User;
        if (user is null || !user.HasClaim(ConnectClaimTypes.Permission, PermissionKeys.BrowseTags))
            throw new HubException("Forbidden: tags.browse permission required");

        var registry = Context.GetHttpContext()?.RequestServices.GetRequiredService<TagPreviewRegistry>();
        var list = paths?
            .Where(p => !string.IsNullOrWhiteSpace(p.Path))
            .Select(p => new TagPreviewRegistry.TagPreviewPath(p.Path.Trim(), p.DataType))
            .ToList() ?? [];
        registry?.Set(Context.ConnectionId, plcConnectionId, list);
        return Task.CompletedTask;
    }

    public record TagPreviewPathDto(string Path, string? DataType);

    public override Task OnConnectedAsync()
    {
        var counter = Context.GetHttpContext()?.RequestServices.GetRequiredService<LiveHubConnectionCounter>();
        counter?.Connected();
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        var services = Context.GetHttpContext()?.RequestServices;
        services?.GetRequiredService<TagPreviewRegistry>().Remove(Context.ConnectionId);
        services?.GetRequiredService<LiveHubConnectionCounter>().Disconnected();
        return base.OnDisconnectedAsync(exception);
    }
}
