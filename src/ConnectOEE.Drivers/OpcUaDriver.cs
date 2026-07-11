using System.Globalization;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Opc.Ua;
using Opc.Ua.Client;
using Opc.Ua.Configuration;

namespace ConnectOEE.Drivers;

/// <summary>Connection options for an OPC UA server endpoint.</summary>
public record OpcUaConnectionOptions(
    string EndpointUrl,
    int TimeoutMs = 8000,
    bool PreferSecurity = true,
    int BrowseMaxDepth = 5,
    int BrowseMaxNodes = 400);

/// <summary>Binds a logical signal to an OPC UA NodeId string (e.g. <c>ns=2;s=SlowUInt1</c>).</summary>
public record OpcUaTagBinding(
    Guid MachineId,
    Guid LineId,
    SignalRole Role,
    string TagPath,
    TagDataType DataType);

/// <summary>
/// OPC UA client driver (OPC Foundation .NET Standard). Connects anonymously to an endpoint
/// URL (e.g. Docker opc-plc at <c>opc.tcp://localhost:50000</c>), browses the address space,
/// and polls mapped NodeIds into <see cref="SignalReading"/>s.
/// </summary>
public sealed class OpcUaDriver : IPlcDriver, ITagBrowsingDriver, IDriverDiagnostics, IDisposable
{
    private const int StaleAfterFailures = 3;
    private const int FaultedAfterFailures = 8;

    private readonly OpcUaConnectionOptions _opt;
    private readonly IReadOnlyList<OpcUaTagBinding> _signals;
    private readonly ILogger _logger;
    private readonly object _gate = new();
    private ApplicationConfiguration? _config;
    private Session? _session;
    private int _consecutiveFailures;
    private string? _statusDetail;

    public OpcUaDriver(
        OpcUaConnectionOptions options,
        IEnumerable<OpcUaTagBinding> signals,
        ILogger? logger = null)
    {
        _opt = options;
        _signals = signals.ToList();
        _logger = logger ?? NullLogger.Instance;
    }

    public DriverType Type => DriverType.OpcUa;
    public ConnectionState State { get; private set; } = ConnectionState.Disconnected;
    public bool SupportsBrowsing => true;
    public string? StatusDetail => _statusDetail;

    public static string NormalizeEndpoint(string? endpoint)
    {
        var url = (endpoint ?? "").Trim();
        if (string.IsNullOrEmpty(url)) return url;
        if (!url.Contains("://", StringComparison.Ordinal))
            url = "opc.tcp://" + url;
        return url;
    }

    // ----- Lifecycle -----

    public async Task ConnectAsync(CancellationToken ct = default)
    {
        State = ConnectionState.Connecting;
        try
        {
            await EnsureSessionAsync(ct);
            State = ConnectionState.Connected;
            _consecutiveFailures = 0;
            _statusDetail = _signals.Count > 0
                ? $"Polling {_signals.Count} node(s) on {_opt.EndpointUrl}"
                : $"Connected to {_opt.EndpointUrl} — no mapped tags";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OPC UA connect failed for {Endpoint}", _opt.EndpointUrl);
            State = ConnectionState.Faulted;
            _statusDetail = $"Connect failed: {ex.Message}";
            DisposeSession();
        }
    }

    public Task DisconnectAsync(CancellationToken ct = default)
    {
        DisposeSession();
        State = ConnectionState.Disconnected;
        _statusDetail = null;
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<SignalReading>> PollAsync(CancellationToken ct = default)
    {
        if (_signals.Count == 0) return Array.Empty<SignalReading>();

        var now = DateTimeOffset.UtcNow;
        var readings = new List<SignalReading>(_signals.Count);
        var anySuccess = false;
        var anyFailure = false;

        try
        {
            await EnsureSessionAsync(ct);
            var paths = _signals.Select(s => s.TagPath).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var values = await ReadNodesAsync(paths, ct);

            foreach (var b in _signals)
            {
                if (!values.TryGetValue(b.TagPath, out var sample))
                {
                    anyFailure = true;
                    continue;
                }

                if (sample.Quality == ValueQuality.Good) anySuccess = true;
                else anyFailure = true;

                int? fault = b.Role == SignalRole.DowntimeReason ? (int)sample.Value : null;
                readings.Add(new SignalReading(
                    b.MachineId, b.LineId, b.Role, sample.Value, null, fault, now, sample.Quality, sample.Display));
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "OPC UA poll failed");
            anyFailure = true;
        }

        UpdateStateAfterPoll(anySuccess, anyFailure);
        return readings;
    }

    public async Task<(bool Ok, string Message, int TagCount)> ProbeAsync(CancellationToken ct = default)
    {
        try
        {
            await EnsureSessionAsync(ct);
            Session session;
            lock (_gate) session = _session ?? throw new InvalidOperationException("No session.");

            // Count Variable nodes one level under Objects (fast reachability + usefulness check).
            var refs = BrowseChildren(session, ObjectIds.ObjectsFolder, ct);
            var variables = 0;
            var folders = 0;
            foreach (var r in refs)
            {
                if (r.NodeClass == NodeClass.Variable) variables++;
                else if (r.NodeClass is NodeClass.Object or NodeClass.ObjectType) folders++;
            }

            var security = session.Endpoint?.SecurityMode.ToString() ?? "Unknown";
            return (
                true,
                $"Connected to {_opt.EndpointUrl} ({security}) — Objects has {folders} folder(s) and {variables} variable(s) at root.",
                variables + folders);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OPC UA probe failed for {Endpoint}", _opt.EndpointUrl);
            DisposeSession();
            return (false, $"Could not reach {_opt.EndpointUrl}: {ex.Message}", 0);
        }
    }

    // ----- Browse -----

    public async Task<IReadOnlyList<BrowseTag>> BrowseAsync(
        CancellationToken ct = default,
        IProgress<BrowseProgress>? progress = null)
    {
        progress?.Report(new BrowseProgress(5, "Connecting…"));
        await EnsureSessionAsync(ct);
        Session session;
        lock (_gate) session = _session ?? throw new InvalidOperationException("No session.");

        progress?.Report(new BrowseProgress(15, "Browsing address space…"));
        var remaining = _opt.BrowseMaxNodes;
        var tree = BrowseRecursive(session, ObjectIds.ObjectsFolder, "Objects", 0, ref remaining, progress, ct);
        progress?.Report(new BrowseProgress(100, remaining == _opt.BrowseMaxNodes ? "Empty" : "Ready"));
        return tree;
    }

    public async Task<IReadOnlyList<TagValueSample>> ReadValuesAsync(
        IEnumerable<TagReadRequest> requests,
        CancellationToken ct = default)
    {
        var paths = requests
            .Where(r => !string.IsNullOrWhiteSpace(r.Path))
            .Select(r => r.Path.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (paths.Count == 0) return Array.Empty<TagValueSample>();

        try
        {
            await EnsureSessionAsync(ct);
            var map = await ReadNodesAsync(paths, ct);
            return paths.Select(p => map.TryGetValue(p, out var s)
                ? s
                : new TagValueSample(p, 0, ValueQuality.Bad, DateTimeOffset.UtcNow, "—")).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "OPC UA preview read failed");
            var now = DateTimeOffset.UtcNow;
            return paths.Select(p => new TagValueSample(p, 0, ValueQuality.Bad, now, "—")).ToList();
        }
    }

    public void Dispose() => DisposeSession();

    // ----- Internals -----

    private async Task EnsureSessionAsync(CancellationToken ct)
    {
        lock (_gate)
        {
            if (_session is { Connected: true }) return;
        }

        DisposeSession();
        var config = await BuildConfigurationAsync(_opt.TimeoutMs);
        _config = config;

        var url = NormalizeEndpoint(_opt.EndpointUrl);
        Exception? last = null;
        foreach (var useSecurity in _opt.PreferSecurity ? new[] { true, false } : new[] { false, true })
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var selected = CoreClientUtils.SelectEndpoint(config, url, useSecurity, _opt.TimeoutMs);
                var endpointConfig = EndpointConfiguration.Create(config);
                var configured = new ConfiguredEndpoint(null, selected, endpointConfig);
                var session = await Session.Create(
                    config,
                    configured,
                    updateBeforeConnect: false,
                    sessionName: "ConnectOEE",
                    sessionTimeout: 60_000,
                    identity: new UserIdentity(new AnonymousIdentityToken()),
                    preferredLocales: null,
                    ct);

                lock (_gate) _session = session;
                _logger.LogInformation(
                    "OPC UA session established to {Endpoint} ({Mode})",
                    url, selected.SecurityMode);
                return;
            }
            catch (Exception ex)
            {
                last = ex;
                _logger.LogDebug(ex, "OPC UA connect attempt security={Security} failed", useSecurity);
            }
        }

        throw last ?? new InvalidOperationException($"Could not open OPC UA session to {url}.");
    }

    private static async Task<ApplicationConfiguration> BuildConfigurationAsync(int timeoutMs)
    {
        var pkiRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ConnectOEE", "opcua-pki");

        var config = new ApplicationConfiguration
        {
            ApplicationName = "ConnectOEE",
            ApplicationUri = "urn:ConnectOEE:OpcUaClient",
            ApplicationType = ApplicationType.Client,
            SecurityConfiguration = new SecurityConfiguration
            {
                ApplicationCertificate = new CertificateIdentifier
                {
                    StoreType = CertificateStoreType.Directory,
                    StorePath = Path.Combine(pkiRoot, "own"),
                    SubjectName = "CN=ConnectOEE",
                },
                TrustedIssuerCertificates = new CertificateTrustList
                {
                    StoreType = CertificateStoreType.Directory,
                    StorePath = Path.Combine(pkiRoot, "issuer"),
                },
                TrustedPeerCertificates = new CertificateTrustList
                {
                    StoreType = CertificateStoreType.Directory,
                    StorePath = Path.Combine(pkiRoot, "trusted"),
                },
                RejectedCertificateStore = new CertificateTrustList
                {
                    StoreType = CertificateStoreType.Directory,
                    StorePath = Path.Combine(pkiRoot, "rejected"),
                },
                AutoAcceptUntrustedCertificates = true,
                AddAppCertToTrustedStore = true,
                RejectSHA1SignedCertificates = false,
                MinimumCertificateKeySize = 1024,
            },
            TransportQuotas = new TransportQuotas { OperationTimeout = Math.Max(timeoutMs, 5000) },
            ClientConfiguration = new ClientConfiguration { DefaultSessionTimeout = 60_000 },
            DisableHiResClock = true,
        };

        await config.Validate(ApplicationType.Client);
        var app = new ApplicationInstance
        {
            ApplicationName = config.ApplicationName,
            ApplicationType = ApplicationType.Client,
            ApplicationConfiguration = config,
        };
        await app.CheckApplicationInstanceCertificates(true);

        config.CertificateValidator.CertificateValidation += (_, e) =>
        {
            e.Accept = true;
        };

        return config;
    }

    private async Task<Dictionary<string, TagValueSample>> ReadNodesAsync(
        IReadOnlyList<string> paths,
        CancellationToken ct)
    {
        Session session;
        lock (_gate) session = _session ?? throw new InvalidOperationException("No session.");

        var nodesToRead = new ReadValueIdCollection();
        var order = new List<string>();
        foreach (var path in paths)
        {
            try
            {
                nodesToRead.Add(new ReadValueId
                {
                    NodeId = NodeId.Parse(path),
                    AttributeId = Attributes.Value,
                });
                order.Add(path);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Invalid OPC UA NodeId {Path}", path);
            }
        }

        var result = new Dictionary<string, TagValueSample>(StringComparer.OrdinalIgnoreCase);
        if (nodesToRead.Count == 0) return result;

        DataValueCollection results;
        lock (_gate)
        {
            ct.ThrowIfCancellationRequested();
            session.Read(
                null,
                0,
                TimestampsToReturn.Both,
                nodesToRead,
                out results,
                out _);
        }

        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < order.Count; i++)
        {
            var path = order[i];
            if (results is null || i >= results.Count)
            {
                result[path] = new TagValueSample(path, 0, ValueQuality.Bad, now, "—");
                continue;
            }

            result[path] = ToSample(path, results[i], now);
        }

        return result;
    }

    private static TagValueSample ToSample(string path, DataValue dv, DateTimeOffset now)
    {
        if (StatusCode.IsBad(dv.StatusCode))
            return new TagValueSample(path, 0, ValueQuality.Bad, now, dv.StatusCode.ToString());

        var (value, display, text) = Coerce(dv.Value);
        var quality = StatusCode.IsGood(dv.StatusCode) ? ValueQuality.Good : ValueQuality.Uncertain;
        var ts = dv.SourceTimestamp != DateTime.MinValue
            ? new DateTimeOffset(DateTime.SpecifyKind(dv.SourceTimestamp, DateTimeKind.Utc))
            : now;
        return new TagValueSample(path, value, quality, ts, text ?? display);
    }

    private static (double Value, string Display, string? Text) Coerce(object? raw)
    {
        if (raw is null) return (0, "null", null);
        switch (raw)
        {
            case bool b:
                return (b ? 1 : 0, b ? "true" : "false", null);
            case sbyte or byte or short or ushort or int or uint or long or ulong:
                var n = Convert.ToDouble(raw, CultureInfo.InvariantCulture);
                return (n, n.ToString(CultureInfo.InvariantCulture), null);
            case float f:
                return (f, f.ToString("G6", CultureInfo.InvariantCulture), null);
            case double d:
                return (d, d.ToString("G6", CultureInfo.InvariantCulture), null);
            case string s:
                return (0, s, s);
            case Variant v:
                return Coerce(v.Value);
            default:
                if (raw is IFormattable fmt)
                {
                    var t = fmt.ToString(null, CultureInfo.InvariantCulture);
                    if (double.TryParse(t, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
                        return (parsed, t, null);
                    return (0, t, t);
                }

                var s2 = raw.ToString() ?? "";
                return (0, s2, s2);
        }
    }

    private List<BrowseTag> BrowseRecursive(
        Session session,
        NodeId parentId,
        string parentPath,
        int depth,
        ref int remaining,
        IProgress<BrowseProgress>? progress,
        CancellationToken ct)
    {
        var list = new List<BrowseTag>();
        if (depth > _opt.BrowseMaxDepth || remaining <= 0) return list;

        ReferenceDescriptionCollection refs;
        try { refs = BrowseChildren(session, parentId, ct); }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "OPC UA browse failed under {Path}", parentPath);
            return list;
        }

        var i = 0;
        foreach (var r in refs)
        {
            ct.ThrowIfCancellationRequested();
            if (remaining <= 0) break;
            // Skip the standard Server diagnostics tree — noisy for OEE mapping.
            if (depth == 0 && string.Equals(r.BrowseName?.Name, "Server", StringComparison.OrdinalIgnoreCase))
                continue;

            var nodeId = ExpandedNodeId.ToNodeId(r.NodeId, session.NamespaceUris);
            var path = nodeId?.ToString() ?? r.NodeId.ToString();
            var name = r.DisplayName?.Text ?? r.BrowseName?.Name ?? path;
            remaining--;
            i++;
            if (i % 20 == 0)
            {
                var pct = 15 + (int)(80.0 * (1.0 - (double)remaining / Math.Max(1, _opt.BrowseMaxNodes)));
                progress?.Report(new BrowseProgress(Math.Min(95, pct), $"Browsing {name}…"));
            }

            if (r.NodeClass == NodeClass.Variable)
            {
                var dt = MapDataType(session, nodeId);
                list.Add(new BrowseTag(name, path, dt, null, 0, r.BrowseName?.Name, true, Array.Empty<BrowseTag>()));
            }
            else if (r.NodeClass == NodeClass.Object)
            {
                var children = BrowseRecursive(session, nodeId!, path, depth + 1, ref remaining, progress, ct);
                list.Add(new BrowseTag(name, path, TagDataType.Udt, null, 0, null, false, children));
            }
        }

        return list;
    }

    private static ReferenceDescriptionCollection BrowseChildren(Session session, NodeId nodeId, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        session.Browse(
            null,
            null,
            nodeId,
            0u,
            BrowseDirection.Forward,
            ReferenceTypeIds.HierarchicalReferences,
            true,
            (uint)NodeClass.Object | (uint)NodeClass.Variable,
            out _,
            out var refs);
        return refs ?? [];
    }

    private static TagDataType MapDataType(Session session, NodeId? nodeId)
    {
        if (nodeId is null) return TagDataType.Unknown;
        try
        {
            var dv = session.ReadValue(nodeId);
            return dv.WrappedValue.TypeInfo?.BuiltInType switch
            {
                BuiltInType.Boolean => TagDataType.Bool,
                BuiltInType.Float or BuiltInType.Double => TagDataType.Real,
                BuiltInType.String or BuiltInType.LocalizedText => TagDataType.String,
                BuiltInType.Int16 or BuiltInType.Int32 => TagDataType.Int,
                BuiltInType.Int64 => TagDataType.Dint,
                BuiltInType.UInt16 or BuiltInType.Byte or BuiltInType.SByte => TagDataType.UInt,
                BuiltInType.UInt32 or BuiltInType.UInt64 => TagDataType.Dint,
                _ => TagDataType.Unknown,
            };
        }
        catch
        {
            return TagDataType.Unknown;
        }
    }

    private void UpdateStateAfterPoll(bool anySuccess, bool anyFailure)
    {
        if (anySuccess)
        {
            _consecutiveFailures = 0;
            State = ConnectionState.Connected;
            _statusDetail = $"Polling {_signals.Count} node(s) on {_opt.EndpointUrl}";
            return;
        }

        if (!anyFailure) return;

        _consecutiveFailures++;
        State = _consecutiveFailures >= FaultedAfterFailures
            ? ConnectionState.Faulted
            : _consecutiveFailures >= StaleAfterFailures
                ? ConnectionState.Stale
                : State;
        _statusDetail = State == ConnectionState.Faulted
            ? $"Read failures ({_consecutiveFailures} consecutive) — check NodeIds / endpoint"
            : $"Intermittent read failures ({_consecutiveFailures})";

        if (State == ConnectionState.Faulted)
            DisposeSession();
    }

    private void DisposeSession()
    {
        Session? session;
        lock (_gate)
        {
            session = _session;
            _session = null;
        }

        try { session?.Close(); } catch { /* ignore */ }
        try { session?.Dispose(); } catch { /* ignore */ }
    }
}
