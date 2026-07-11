using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using FluentModbus;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace ConnectOEE.Drivers;

/// <summary>Connection options for a Modbus TCP slave.</summary>
public record ModbusConnectionOptions(
    string Host,
    int Port = 502,
    byte UnitId = 1,
    int TimeoutMs = 3000,
    /// <summary>Highest 0-based holding/input offset to scan during browse discovery.</summary>
    int DiscoverMaxRegister = 10000,
    /// <summary>Highest 0-based coil/discrete offset to scan during browse discovery.</summary>
    int DiscoverMaxBit = 2000);

/// <summary>Binds a logical signal to a Modbus address path (e.g. <c>hr0</c>, <c>40001</c>).</summary>
public record ModbusTagBinding(
    Guid MachineId,
    Guid LineId,
    SignalRole Role,
    string TagPath,
    TagDataType DataType);

/// <summary>
/// Modbus TCP driver (FluentModbus). Reads mapped holding/input registers and coils,
/// discovers live registers for Tag Mapping (not a synthetic 0..N map), and reports connection health.
/// Endpoint is stored as <c>host:port</c>; unit ID lives in the connection path field.
/// </summary>
public sealed class ModbusTcpDriver : IPlcDriver, ITagBrowsingDriver, IDriverDiagnostics, IDisposable
{
    private const int StaleAfterFailures = 3;
    private const int FaultedAfterFailures = 8;

    private static readonly Regex Prefixed = new(
        @"^(?<kind>hr|holding|ir|input|c|coil|di|discrete)[:\s_]*(?<addr>\d+)(?<suffix>:f32|:float|\.f32)?$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex Classic = new(
        @"^(?<prefix>[0134])(?<addr>\d{4,5})(?<suffix>:f32|:float|\.f32)?$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly ModbusConnectionOptions _opt;
    private readonly IReadOnlyList<ModbusTagBinding> _signals;
    private readonly ILogger _logger;
    private readonly object _gate = new();
    private ModbusTcpClient? _client;
    private int _consecutiveFailures;
    private string? _statusDetail;

    public ModbusTcpDriver(
        ModbusConnectionOptions options,
        IEnumerable<ModbusTagBinding> signals,
        ILogger? logger = null)
    {
        _opt = options;
        _signals = signals.ToList();
        _logger = logger ?? NullLogger.Instance;
    }

    public DriverType Type => DriverType.ModbusTcp;
    public ConnectionState State { get; private set; } = ConnectionState.Disconnected;
    public bool SupportsBrowsing => true;
    public string? StatusDetail => _statusDetail;

    /// <summary>Parse <c>host</c> or <c>host:port</c> plus optional unit-id path into connection options.</summary>
    public static ModbusConnectionOptions ParseEndpoint(string endpoint, string? unitIdPath, int timeoutMs = 3000)
    {
        var host = endpoint.Trim();
        var port = 502;
        var colon = host.LastIndexOf(':');
        if (colon > 0
            && colon < host.Length - 1
            && !host.Contains("://", StringComparison.Ordinal)
            && int.TryParse(host[(colon + 1)..], NumberStyles.None, CultureInfo.InvariantCulture, out var p)
            && p is > 0 and <= 65535)
        {
            port = p;
            host = host[..colon];
        }

        byte unit = 1;
        if (!string.IsNullOrWhiteSpace(unitIdPath)
            && byte.TryParse(unitIdPath.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var u))
            unit = u;

        return new ModbusConnectionOptions(host, port, unit, timeoutMs);
    }

    public static string FormatEndpoint(string host, int port) =>
        port == 502 ? host.Trim() : $"{host.Trim()}:{port}";

    // ----- Lifecycle -----

    public Task ConnectAsync(CancellationToken ct = default)
    {
        State = ConnectionState.Connecting;
        try
        {
            EnsureClient();
            State = ConnectionState.Connected;
            _consecutiveFailures = 0;
            _statusDetail = _signals.Count > 0
                ? $"Polling {_signals.Count} address(es) on {_opt.Host}:{_opt.Port} (unit {_opt.UnitId})"
                : $"Connected to {_opt.Host}:{_opt.Port} (unit {_opt.UnitId}) — no mapped tags";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Modbus TCP connect failed for {Host}:{Port}", _opt.Host, _opt.Port);
            State = ConnectionState.Faulted;
            _statusDetail = $"Connect failed: {ex.Message}";
            DisposeClient();
        }

        return Task.CompletedTask;
    }

    public Task DisconnectAsync(CancellationToken ct = default)
    {
        DisposeClient();
        State = ConnectionState.Disconnected;
        _statusDetail = null;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<SignalReading>> PollAsync(CancellationToken ct = default)
    {
        if (_signals.Count == 0) return Task.FromResult<IReadOnlyList<SignalReading>>(Array.Empty<SignalReading>());

        var now = DateTimeOffset.UtcNow;
        var readings = new List<SignalReading>(_signals.Count);
        var anySuccess = false;
        var anyFailure = false;

        var values = new Dictionary<string, (double Value, ValueQuality Quality)>(StringComparer.OrdinalIgnoreCase);
        foreach (var path in _signals.Select(s => s.TagPath).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                var binding = _signals.First(s => string.Equals(s.TagPath, path, StringComparison.OrdinalIgnoreCase));
                values[path] = (ReadAddress(path, binding.DataType), ValueQuality.Good);
                anySuccess = true;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Modbus read failed for {Path}", path);
                values[path] = (0, ValueQuality.Bad);
                anyFailure = true;
            }
        }

        foreach (var b in _signals)
        {
            if (!values.TryGetValue(b.TagPath, out var v)) continue;
            int? fault = b.Role == SignalRole.DowntimeReason ? (int)v.Value : null;
            readings.Add(new SignalReading(b.MachineId, b.LineId, b.Role, v.Value, null, fault, now, v.Quality));
        }

        UpdateStateAfterPoll(anySuccess, anyFailure);
        return Task.FromResult<IReadOnlyList<SignalReading>>(readings);
    }

    /// <summary>Reachability probe: TCP connect + read holding register 0.</summary>
    public Task<(bool Ok, string Message, int TagCount)> ProbeAsync(CancellationToken ct = default)
    {
        try
        {
            EnsureClient();
            lock (_gate)
            {
                var regs = _client!.ReadHoldingRegisters<ushort>(_opt.UnitId, 0, 1);
                var value = regs.Length > 0 ? regs[0] : (ushort)0;
                return Task.FromResult((
                    true,
                    $"Connected to {_opt.Host}:{_opt.Port} (unit {_opt.UnitId}) — holding register 0 = {value}. Map addresses like hr0, 40001, c0, ir0.",
                    1));
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Modbus TCP probe failed for {Host}:{Port}", _opt.Host, _opt.Port);
            DisposeClient();
            return Task.FromResult((false, $"Could not reach {_opt.Host}:{_opt.Port}: {ex.Message}", 0));
        }
    }

    // ----- Browse -----

    /// <summary>
    /// Discovers registers the slave is actually serving. Many slaves return 0 for empty
    /// addresses (no illegal-address exception), so we scan and keep non-zero values,
    /// coalescing adjacent holding words into a single float when the IEEE decode looks real.
    /// </summary>
    public Task<IReadOnlyList<BrowseTag>> BrowseAsync(
        CancellationToken ct = default,
        IProgress<BrowseProgress>? progress = null)
    {
        progress?.Report(new BrowseProgress(5, "Connecting…"));
        EnsureClient();

        var maxReg = Math.Clamp(_opt.DiscoverMaxRegister, 1, 65535);
        var maxBit = Math.Clamp(_opt.DiscoverMaxBit, 0, 65535);
        var leaves = new List<BrowseTag>();

        progress?.Report(new BrowseProgress(15, "Scanning holding registers…"));
        var holdingHits = ScanRegisterTable(ModbusTable.Holding, maxReg, ct);
        leaves.AddRange(BuildHoldingLeaves(holdingHits));

        progress?.Report(new BrowseProgress(55, "Scanning input registers…"));
        var inputHits = ScanRegisterTable(ModbusTable.Input, maxReg, ct);
        foreach (var (offset, value) in inputHits.OrderBy(x => x.Key))
        {
            var classic = 30001 + offset;
            leaves.Add(new BrowseTag(
                classic.ToString(CultureInfo.InvariantCulture),
                classic.ToString(CultureInfo.InvariantCulture),
                TagDataType.UInt,
                null,
                0,
                $"Input register {classic} = {value}",
                true,
                Array.Empty<BrowseTag>()));
        }

        progress?.Report(new BrowseProgress(80, "Scanning coils & discretes…"));
        foreach (var offset in ScanBits(ModbusTable.Coil, maxBit, ct))
        {
            var classic = 1 + offset; // 00001-style
            var path = classic.ToString("D5", CultureInfo.InvariantCulture);
            leaves.Add(new BrowseTag(path, path, TagDataType.Bool, null, 0, $"Coil {path}", true, Array.Empty<BrowseTag>()));
        }

        foreach (var offset in ScanBits(ModbusTable.Discrete, maxBit, ct))
        {
            var classic = 10001 + offset;
            var path = classic.ToString(CultureInfo.InvariantCulture);
            leaves.Add(new BrowseTag(path, path, TagDataType.Bool, null, 0, $"Discrete input {path}", true, Array.Empty<BrowseTag>()));
        }

        progress?.Report(new BrowseProgress(100, leaves.Count == 0 ? "No live registers found" : $"Found {leaves.Count} register(s)"));
        return Task.FromResult<IReadOnlyList<BrowseTag>>(leaves);
    }

    private Dictionary<ushort, ushort> ScanRegisterTable(ModbusTable table, int maxOffset, CancellationToken ct)
    {
        var hits = new Dictionary<ushort, ushort>();
        const int chunk = 125;
        for (var start = 0; start <= maxOffset; start += chunk)
        {
            ct.ThrowIfCancellationRequested();
            var count = (ushort)Math.Min(chunk, maxOffset - start + 1);
            if (count == 0) break;
            try
            {
                Span<ushort> regs;
                lock (_gate)
                {
                    var client = _client ?? throw new InvalidOperationException("Modbus client not connected.");
                    regs = table == ModbusTable.Holding
                        ? client.ReadHoldingRegisters<ushort>(_opt.UnitId, (ushort)start, count)
                        : client.ReadInputRegisters<ushort>(_opt.UnitId, (ushort)start, count);
                }

                for (var i = 0; i < regs.Length; i++)
                {
                    if (regs[i] == 0) continue;
                    hits[(ushort)(start + i)] = regs[i];
                }
            }
            catch (ModbusException ex) when (ex.ExceptionCode == ModbusExceptionCode.IllegalDataAddress)
            {
                // Sparse map: fall back to single-register probes in this window.
                ProbeRegisterWindow(table, start, count, hits, ct);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Modbus {Table} scan at {Start} failed", table, start);
                ProbeRegisterWindow(table, start, count, hits, ct);
            }
        }

        return hits;
    }

    private void ProbeRegisterWindow(
        ModbusTable table,
        int start,
        int count,
        Dictionary<ushort, ushort> hits,
        CancellationToken ct)
    {
        for (var i = 0; i < count; i++)
        {
            ct.ThrowIfCancellationRequested();
            var offset = (ushort)(start + i);
            try
            {
                ushort value;
                lock (_gate)
                {
                    var client = _client ?? throw new InvalidOperationException("Modbus client not connected.");
                    value = table == ModbusTable.Holding
                        ? client.ReadHoldingRegisters<ushort>(_opt.UnitId, offset, 1)[0]
                        : client.ReadInputRegisters<ushort>(_opt.UnitId, offset, 1)[0];
                }

                if (value != 0) hits[offset] = value;
            }
            catch (ModbusException)
            {
                // Address not mapped — skip.
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Modbus probe {Table} {Offset} failed", table, offset);
            }
        }
    }

    private List<ushort> ScanBits(ModbusTable table, int maxOffset, CancellationToken ct)
    {
        if (maxOffset <= 0) return [];
        var hits = new List<ushort>();
        const int chunk = 2000;
        for (var start = 0; start <= maxOffset; start += chunk)
        {
            ct.ThrowIfCancellationRequested();
            var count = Math.Min(chunk, maxOffset - start + 1);
            try
            {
                Span<byte> packed;
                lock (_gate)
                {
                    var client = _client ?? throw new InvalidOperationException("Modbus client not connected.");
                    packed = table == ModbusTable.Coil
                        ? client.ReadCoils(_opt.UnitId, start, count)
                        : client.ReadDiscreteInputs(_opt.UnitId, start, count);
                }

                for (var i = 0; i < count; i++)
                {
                    var byteIndex = i / 8;
                    if (byteIndex >= packed.Length) break;
                    if ((packed[byteIndex] & (1 << (i % 8))) == 0) continue;
                    hits.Add((ushort)(start + i));
                }
            }
            catch (ModbusException)
            {
                // No coils/discretes in this range.
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Modbus {Table} bit scan at {Start} failed", table, start);
            }
        }

        return hits;
    }

    private List<BrowseTag> BuildHoldingLeaves(Dictionary<ushort, ushort> hits)
    {
        var leaves = new List<BrowseTag>();
        var skipped = new HashSet<ushort>();
        foreach (var offset in hits.Keys.OrderBy(x => x))
        {
            if (skipped.Contains(offset)) continue;
            var next = (ushort)(offset + 1);
            if (hits.ContainsKey(next) && TryReadPlausibleFloat(offset, out var f))
            {
                var classic = 40001 + offset;
                var path = $"{classic}:f32";
                leaves.Add(new BrowseTag(
                    classic.ToString(CultureInfo.InvariantCulture),
                    path,
                    TagDataType.Real,
                    null,
                    0,
                    $"Holding float {classic} = {f.ToString("G6", CultureInfo.InvariantCulture)}",
                    true,
                    Array.Empty<BrowseTag>()));
                skipped.Add(next);
                continue;
            }

            var c = 40001 + offset;
            var pathInt = c.ToString(CultureInfo.InvariantCulture);
            leaves.Add(new BrowseTag(
                pathInt,
                pathInt,
                TagDataType.UInt,
                null,
                0,
                $"Holding register {c} = {hits[offset]}",
                true,
                Array.Empty<BrowseTag>()));
        }

        return leaves;
    }

    private bool TryReadPlausibleFloat(ushort offset, out float value)
    {
        value = 0;
        try
        {
            lock (_gate)
            {
                var client = _client ?? throw new InvalidOperationException("Modbus client not connected.");
                value = client.ReadHoldingRegisters<float>(_opt.UnitId, offset, 1)[0];
            }

            // Reject denormals / garbage from two unrelated small integers (e.g. 100 + 38).
            return float.IsFinite(value) && Math.Abs(value) is >= 1e-2f and <= 1e7f;
        }
        catch
        {
            return false;
        }
    }

    public Task<IReadOnlyList<TagValueSample>> ReadValuesAsync(
        IEnumerable<TagReadRequest> requests,
        CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var samples = new List<TagValueSample>();
        foreach (var req in requests)
        {
            if (string.IsNullOrWhiteSpace(req.Path)) continue;
            var path = req.Path.Trim();
            try
            {
                var value = ReadAddress(path, req.DataType);
                samples.Add(new TagValueSample(path, value, ValueQuality.Good, now, FormatDisplay(path, value, req.DataType)));
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Modbus preview read failed for {Path}", path);
                samples.Add(new TagValueSample(path, 0, ValueQuality.Bad, now, "—"));
            }
        }

        return Task.FromResult<IReadOnlyList<TagValueSample>>(samples);
    }

    public void Dispose() => DisposeClient();

    // ----- Internals -----

    private void EnsureClient()
    {
        lock (_gate)
        {
            if (_client is { IsConnected: true }) return;

            DisposeClientUnlocked();
            var client = new ModbusTcpClient
            {
                ConnectTimeout = _opt.TimeoutMs,
                ReadTimeout = _opt.TimeoutMs,
                WriteTimeout = _opt.TimeoutMs,
            };
            var ep = new IPEndPoint(IPAddress.Parse(ResolveHost(_opt.Host)), _opt.Port);
            client.Connect(ep, ModbusEndianness.BigEndian);
            _client = client;
        }
    }

    private static string ResolveHost(string host)
    {
        if (IPAddress.TryParse(host, out _)) return host;
        var addresses = Dns.GetHostAddresses(host);
        if (addresses.Length == 0)
            throw new InvalidOperationException($"Could not resolve host '{host}'.");
        return addresses[0].ToString();
    }

    private void DisposeClient()
    {
        lock (_gate) DisposeClientUnlocked();
    }

    private void DisposeClientUnlocked()
    {
        try { _client?.Disconnect(); } catch { /* ignore */ }
        try { _client?.Dispose(); } catch { /* ignore */ }
        _client = null;
    }

    private double ReadAddress(string path, TagDataType hint)
    {
        if (!TryParseAddress(path, out var addr))
            throw new ArgumentException($"Unrecognized Modbus address '{path}'. Use hr0, 40001, c0, ir0, di0.");

        EnsureClient();
        lock (_gate)
        {
            var client = _client ?? throw new InvalidOperationException("Modbus client not connected.");
            var asFloat = addr.AsFloat || hint == TagDataType.Real;
            return addr.Table switch
            {
                ModbusTable.Holding when asFloat => client.ReadHoldingRegisters<float>(_opt.UnitId, addr.Offset, 1)[0],
                ModbusTable.Holding => client.ReadHoldingRegisters<ushort>(_opt.UnitId, addr.Offset, 1)[0],
                ModbusTable.Input when asFloat => client.ReadInputRegisters<float>(_opt.UnitId, addr.Offset, 1)[0],
                ModbusTable.Input => client.ReadInputRegisters<ushort>(_opt.UnitId, addr.Offset, 1)[0],
                ModbusTable.Coil => ReadBit(client.ReadCoils(_opt.UnitId, addr.Offset, 1)),
                ModbusTable.Discrete => ReadBit(client.ReadDiscreteInputs(_opt.UnitId, addr.Offset, 1)),
                _ => throw new ArgumentOutOfRangeException(nameof(addr)),
            };
        }
    }

    private static double ReadBit(Span<byte> packed) =>
        packed.Length > 0 && (packed[0] & 0x01) != 0 ? 1 : 0;

    private void UpdateStateAfterPoll(bool anySuccess, bool anyFailure)
    {
        if (anySuccess)
        {
            _consecutiveFailures = 0;
            State = ConnectionState.Connected;
            _statusDetail = $"Polling {_signals.Count} address(es) on {_opt.Host}:{_opt.Port}";
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
            ? $"Read failures ({_consecutiveFailures} consecutive) — check addresses / unit ID"
            : $"Intermittent read failures ({_consecutiveFailures})";

        if (State == ConnectionState.Faulted)
            DisposeClient();
    }

    private static string FormatDisplay(string path, double value, TagDataType hint)
    {
        if (TryParseAddress(path, out var addr))
        {
            if (addr.Table is ModbusTable.Coil or ModbusTable.Discrete || hint == TagDataType.Bool)
                return value >= 0.5 ? "1" : "0";
            if (hint == TagDataType.Real || addr.AsFloat)
                return value.ToString("G6", CultureInfo.InvariantCulture);
        }
        return ((long)Math.Round(value)).ToString(CultureInfo.InvariantCulture);
    }

    public static bool TryParseAddress(string raw, out ModbusAddress address)
    {
        address = default;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var text = raw.Trim();

        var m = Prefixed.Match(text);
        if (m.Success)
        {
            var offset = ushort.Parse(m.Groups["addr"].Value, CultureInfo.InvariantCulture);
            var kind = m.Groups["kind"].Value.ToLowerInvariant();
            var asFloat = m.Groups["suffix"].Success;
            var table = kind switch
            {
                "hr" or "holding" => ModbusTable.Holding,
                "ir" or "input" => ModbusTable.Input,
                "c" or "coil" => ModbusTable.Coil,
                "di" or "discrete" => ModbusTable.Discrete,
                _ => (ModbusTable?)null,
            };
            if (table is null) return false;
            address = new ModbusAddress(table.Value, offset, asFloat && table is ModbusTable.Holding or ModbusTable.Input);
            return true;
        }

        m = Classic.Match(text);
        if (!m.Success) return false;

        var prefix = m.Groups["prefix"].Value[0];
        // Classic notation is 1-based (40001 = holding offset 0).
        var oneBased = int.Parse(m.Groups["addr"].Value, CultureInfo.InvariantCulture);
        if (oneBased < 1) return false;
        var zeroBased = oneBased - 1;
        if (zeroBased > ushort.MaxValue) return false;
        var asF = m.Groups["suffix"].Success;
        address = prefix switch
        {
            '4' => new ModbusAddress(ModbusTable.Holding, (ushort)zeroBased, asF),
            '3' => new ModbusAddress(ModbusTable.Input, (ushort)zeroBased, asF),
            '1' => new ModbusAddress(ModbusTable.Discrete, (ushort)zeroBased, false),
            '0' => new ModbusAddress(ModbusTable.Coil, (ushort)zeroBased, false),
            _ => default,
        };
        return prefix is '0' or '1' or '3' or '4';
    }

    public readonly record struct ModbusAddress(ModbusTable Table, ushort Offset, bool AsFloat);

    public enum ModbusTable
    {
        Holding,
        Input,
        Coil,
        Discrete,
    }
}
