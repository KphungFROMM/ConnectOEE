using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;

namespace ConnectOEE.Api.Middleware;

/// <summary>
/// Auto-audits mutating API calls (POST/PUT/PATCH/DELETE) under /api/.
/// Complements manual _audit.LogAsync calls for sensitive operations.
/// </summary>
public sealed class AuditMiddleware
{
    private static readonly HashSet<string> SkipPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/me",
        "/api/setup/status",
        "/api/system/presence",
    };

    private readonly RequestDelegate _next;

    public AuditMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IAuditService audit)
    {
        var method = context.Request.Method;
        var path = context.Request.Path.Value ?? string.Empty;

        var shouldAudit = path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
            && method is not ("GET" or "HEAD" or "OPTIONS")
            && !SkipPaths.Contains(path.TrimEnd('/'));

        await _next(context);

        if (!shouldAudit) return;
        if (context.Response.StatusCode >= 500) return;

        var userId = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                     ?? context.User.FindFirst("sub")?.Value;
        Guid? uid = Guid.TryParse(userId, out var g) ? g : null;
        var userName = context.User.Identity?.Name
                       ?? context.User.FindFirst("unique_name")?.Value;

        await audit.LogAsync(
            $"http.{method.ToLowerInvariant()}",
            uid,
            userName,
            entityType: "HttpRequest",
            entityId: path,
            details: new { method, path, status = context.Response.StatusCode },
            result: context.Response.StatusCode is >= 200 and < 300 ? "Success" : "Failed");
    }
}
