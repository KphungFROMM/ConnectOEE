using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using libplctag;
using libplctag.DataTypes;
using libplctag.DataTypes.Simple;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace ConnectOEE.Drivers;

/// <summary>Connection-level options for a Rockwell EtherNet/IP endpoint.</summary>
public record RockwellConnectionOptions(
    string Gateway,
    string? Path = "1,0",
    string PlcKind = "ControlLogix",
    int TimeoutMs = 5000,
    int ReadCacheMs = 250);

/// <summary>Binds a logical signal (role) on a machine to a controller tag path.</summary>
public record RockwellTagBinding(
    Guid MachineId,
    Guid LineId,
    SignalRole Role,
    string TagPath,
    TagDataType DataType);

/// <summary>Binds a control command on a machine to a writable controller tag path.</summary>
public record RockwellControlBinding(
    Guid MachineId,
    PlcCommand Command,
    string TagPath,
    TagDataType DataType = TagDataType.Bool);

/// <summary>
/// Rockwell EtherNet/IP driver (ControlLogix / CompactLogix / Micro800) built on
/// libplctag. Reads the mapped signal tags each poll and translates them into
/// driver-agnostic <see cref="SignalReading"/>s, supports controller tag browsing +
/// UDT enumeration for the live tag browser, and writes narrow control commands
/// (start-permissive, reset, ack). Comm loss is surfaced via <see cref="State"/>
/// (Connected -> Stale -> Faulted) so the UI always shows connection health.
///
/// Live read/write is exercised against real hardware in Phase 11 acceptance; without
/// a controller present the driver simply reports Faulted and yields no readings, so the
/// rest of the platform (and the Mock simulator) keeps running.
/// </summary>
public sealed class RockwellDriver : IPlcDriver, ITagBrowsingDriver, IControllableDriver, IDriverDiagnostics, IDisposable
{
    private const int StaleAfterFailures = 3;
    private const int FaultedAfterFailures = 8;
    private const int MaxBrowseDepth = 6;

    private readonly RockwellConnectionOptions _opt;
    private readonly PlcType _plcType;
    private readonly IReadOnlyList<RockwellTagBinding> _signals;
    private readonly IReadOnlyList<RockwellControlBinding> _controls;
    private readonly ILogger _logger;

    // One native tag per distinct read path (shared across bindings to the same tag).
    private readonly Dictionary<string, Tag> _readTags = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Tag> _writeTags = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Tag> _previewTags = new(StringComparer.OrdinalIgnoreCase);
    private int _consecutiveFailures;
    private string? _statusDetail;

    public string? StatusDetail => _statusDetail;

    public RockwellDriver(
        RockwellConnectionOptions options,
        IEnumerable<RockwellTagBinding> signals,
        IEnumerable<RockwellControlBinding>? controls = null,
        ILogger? logger = null)
    {
        _opt = options;
        _plcType = MapPlcKind(options.PlcKind);
        _signals = signals.ToList();
        _controls = (controls ?? Enumerable.Empty<RockwellControlBinding>()).ToList();
        _logger = logger ?? NullLogger.Instance;
    }

    public DriverType Type => DriverType.RockwellEthernetIp;
    public ConnectionState State { get; private set; } = ConnectionState.Disconnected;
    public bool SupportsBrowsing => true;
    public bool SupportsControl => _controls.Count > 0;

    // ----- Lifecycle -----

    public async Task ConnectAsync(CancellationToken ct = default)
    {
        State = ConnectionState.Connecting;
        try
        {
            foreach (var path in _signals.Select(s => s.TagPath).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                var tag = NewTag(path);
                await tag.InitializeAsync(ct);
                _readTags[path] = tag;
            }
            State = _readTags.Count > 0 ? ConnectionState.Connected : ConnectionState.Disconnected;
            _consecutiveFailures = 0;
            _statusDetail = _readTags.Count > 0
                ? $"Polling {_readTags.Count} tag(s) on {_opt.Gateway}"
                : "No mapped tags — map RunState and GoodCount";
        }
        catch (Exception ex)
        {
            // Don't throw - the DriverManager keeps the platform alive and retries.
            _logger.LogWarning(ex, "Rockwell connect failed for {Gateway} ({Path})", _opt.Gateway, _opt.Path);
            State = ConnectionState.Faulted;
            _statusDetail = $"Connect failed: {ex.Message}";
        }
    }

    public Task DisconnectAsync(CancellationToken ct = default)
    {
        foreach (var t in _readTags.Values) t.Dispose();
        foreach (var t in _writeTags.Values) t.Dispose();
        foreach (var t in _previewTags.Values) t.Dispose();
        _readTags.Clear();
        _writeTags.Clear();
        _previewTags.Clear();
        State = ConnectionState.Disconnected;
        return Task.CompletedTask;
    }

    // ----- Polling -----

    public async Task<IReadOnlyList<SignalReading>> PollAsync(CancellationToken ct = default)
    {
        if (_readTags.Count == 0) return Array.Empty<SignalReading>();

        var now = DateTimeOffset.UtcNow;
        var readings = new List<SignalReading>(_signals.Count);
        var anySuccess = false;
        var anyFailure = false;

        // Read each distinct tag once, then fan out to every binding on that path.
        var values = new Dictionary<string, (double Value, ValueQuality Quality)>(StringComparer.OrdinalIgnoreCase);
        foreach (var (path, tag) in _readTags)
        {
            try
            {
                await tag.ReadAsync(ct);
                values[path] = (ReadValue(tag, FindDataType(path)), ValueQuality.Good);
                anySuccess = true;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Rockwell read failed for {Path}", path);
                values[path] = (0, ValueQuality.Bad);
                anyFailure = true;
            }
        }

        foreach (var b in _signals)
        {
            if (!values.TryGetValue(b.TagPath, out var v)) continue;
            RunState? rs = null;
            int? fault = b.Role == SignalRole.DowntimeReason ? (int)v.Value : null;
            readings.Add(new SignalReading(b.MachineId, b.LineId, b.Role, v.Value, rs, fault, now, v.Quality));
        }

        UpdateStateAfterPoll(anySuccess, anyFailure);
        return readings;
    }

    private void UpdateStateAfterPoll(bool anySuccess, bool anyFailure)
    {
        if (anySuccess)
        {
            _consecutiveFailures = 0;
            // Mixed result still counts as connected; per-tag quality already flags bad reads.
            State = ConnectionState.Connected;
            _statusDetail = $"Polling {_readTags.Count} tag(s)";
            return;
        }
        if (anyFailure)
        {
            _consecutiveFailures++;
            State = _consecutiveFailures >= FaultedAfterFailures
                ? ConnectionState.Faulted
                : _consecutiveFailures >= StaleAfterFailures
                    ? ConnectionState.Stale
                    : State;
            _statusDetail = State == ConnectionState.Faulted
                ? $"Read failures ({_consecutiveFailures} consecutive) — check tag paths"
                : $"Intermittent read failures ({_consecutiveFailures})";
        }
    }

    // ----- Control (write-back) -----

    public async Task<bool> WriteCommandAsync(Guid machineId, PlcCommand command, CancellationToken ct = default)
    {
        var binding = _controls.FirstOrDefault(c => c.MachineId == machineId && c.Command == command);
        if (binding is null)
        {
            _logger.LogWarning("No control tag mapped for machine {Machine} command {Command}", machineId, command);
            return false;
        }

        var tag = GetWriteTag(binding.TagPath);
        try
        {
            // StartPermissive holds the enable bit true; Reset/Ack pulse the bit.
            SetBool(tag, binding.DataType, true);
            await tag.WriteAsync(ct);
            if (command is PlcCommand.Reset or PlcCommand.Ack)
            {
                await Task.Delay(150, ct);
                SetBool(tag, binding.DataType, false);
                await tag.WriteAsync(ct);
            }
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Rockwell command {Command} write failed for machine {Machine}", command, machineId);
            return false;
        }
    }

    public async Task<bool> WriteTagAsync(string tagPath, double value, CancellationToken ct = default)
    {
        var tag = GetWriteTag(tagPath);
        try
        {
            // No declared type for a raw write: integral values go as DINT, else REAL.
            if (Math.Abs(value - Math.Round(value)) < double.Epsilon)
                tag.SetInt32(0, (int)Math.Round(value));
            else
                tag.SetFloat32(0, (float)value);
            await tag.WriteAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Rockwell raw write failed for {Path}", tagPath);
            return false;
        }
    }

    // ----- Tag browsing + UDT enumeration -----

    public async Task<IReadOnlyList<BrowseTag>> BrowseAsync(CancellationToken ct = default)
    {
        try
        {
            var listing = new TagTagInfo
            {
                Gateway = _opt.Gateway,
                Path = _opt.Path,
                PlcType = _plcType,
                Protocol = Protocol.ab_eip,
                Name = "@tags",
                Timeout = TimeSpan.FromMilliseconds(_opt.TimeoutMs),
            };
            await listing.ReadAsync(ct);
            var infos = listing.Value ?? Array.Empty<TagInfo>();
            listing.Dispose();

            var udtCache = new Dictionary<ushort, UdtInfo>();
            var result = new List<BrowseTag>();
            foreach (var info in infos)
            {
                if (string.IsNullOrEmpty(info.Name) || info.Name.StartsWith("__", StringComparison.Ordinal))
                    continue; // skip controller-internal/system tags
                result.Add(await ToBrowseTagAsync(info.Name, info.Name, info.Type, info.Dimensions, udtCache, 0, ct));
            }
            return result.OrderBy(t => t.Name, StringComparer.OrdinalIgnoreCase).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Rockwell tag browse failed for {Gateway}", _opt.Gateway);
            return Array.Empty<BrowseTag>();
        }
    }

    public async Task<IReadOnlyList<TagValueSample>> ReadValuesAsync(IEnumerable<TagReadRequest> requests, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var samples = new List<TagValueSample>();
        foreach (var req in requests
                     .Where(r => !string.IsNullOrWhiteSpace(r.Path))
                     .GroupBy(r => r.Path.Trim(), StringComparer.OrdinalIgnoreCase)
                     .Select(g => g.First()))
        {
            var path = req.Path.Trim();
            var dataType = req.DataType == TagDataType.Unknown ? FindDataType(path) : req.DataType;
            try
            {
                var tag = await GetPreviewTagAsync(path, ct);
                await tag.ReadAsync(ct);
                var v = ReadValue(tag, dataType);
                samples.Add(new TagValueSample(path, v, ValueQuality.Good, now, FormatDisplay(v, dataType)));
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Rockwell preview read failed for {Path}", path);
                samples.Add(new TagValueSample(path, 0, ValueQuality.Bad, now, null));
            }
        }
        return samples;
    }

    private async Task<BrowseTag> ToBrowseTagAsync(
        string name, string fullPath, ushort abType, uint[]? dims,
        Dictionary<ushort, UdtInfo> udtCache, int depth, CancellationToken ct)
    {
        var arrayLength = dims is { Length: > 0 } ? (int)dims.Where(d => d > 0).Aggregate(1u, (a, b) => a * b) : 0;
        var isStruct = (abType & 0x8000) != 0;

        if (isStruct && depth < MaxBrowseDepth)
        {
            var udtId = (ushort)(abType & 0x0FFF);
            var udt = await GetUdtAsync(udtId, udtCache, ct);
            var children = new List<BrowseTag>();
            if (udt?.Fields is not null)
            {
                foreach (var f in udt.Fields)
                {
                    if (string.IsNullOrEmpty(f.Name) || f.Name.StartsWith("__", StringComparison.Ordinal)) continue;
                    var childPath = $"{fullPath}.{f.Name}";
                    children.Add(await ToBrowseTagAsync(f.Name, childPath, f.Type, null, udtCache, depth + 1, ct));
                }
            }
            return new BrowseTag(name, fullPath, TagDataType.Udt, udt?.Name, arrayLength, null, false, children);
        }

        var dataType = MapAbType(abType);
        return new BrowseTag(name, fullPath, arrayLength > 0 ? TagDataType.Array : dataType, null, arrayLength, null,
            Bindable: arrayLength == 0 && dataType != TagDataType.Unknown, Array.Empty<BrowseTag>());
    }

    private async Task<UdtInfo?> GetUdtAsync(ushort udtId, Dictionary<ushort, UdtInfo> cache, CancellationToken ct)
    {
        if (cache.TryGetValue(udtId, out var cached)) return cached;
        try
        {
            var udtTag = new TagUdtInfo
            {
                Gateway = _opt.Gateway,
                Path = _opt.Path,
                PlcType = _plcType,
                Protocol = Protocol.ab_eip,
                Name = $"@udt/{udtId}",
                Timeout = TimeSpan.FromMilliseconds(_opt.TimeoutMs),
            };
            await udtTag.ReadAsync(ct);
            var info = udtTag.Value;
            udtTag.Dispose();
            cache[udtId] = info;
            return info;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "UDT {Id} decode failed", udtId);
            return null;
        }
    }

    // ----- Helpers -----

    private Tag NewTag(string name) => new()
    {
        Name = name,
        Gateway = _opt.Gateway,
        Path = _opt.Path,
        PlcType = _plcType,
        Protocol = Protocol.ab_eip,
        Timeout = TimeSpan.FromMilliseconds(_opt.TimeoutMs),
        ReadCacheMillisecondDuration = _opt.ReadCacheMs,
    };

    private Tag GetWriteTag(string path)
    {
        if (_writeTags.TryGetValue(path, out var existing)) return existing;
        var tag = NewTag(path);
        tag.Initialize();
        _writeTags[path] = tag;
        return tag;
    }

    private async Task<Tag> GetPreviewTagAsync(string path, CancellationToken ct)
    {
        if (_previewTags.TryGetValue(path, out var existing)) return existing;
        var tag = NewTag(path);
        await tag.InitializeAsync(ct);
        _previewTags[path] = tag;
        return tag;
    }

    private TagDataType FindDataType(string path)
        => _signals.FirstOrDefault(s => string.Equals(s.TagPath, path, StringComparison.OrdinalIgnoreCase))?.DataType
           ?? TagDataType.Unknown;

    private static double ReadValue(Tag tag, TagDataType dt) => dt switch
    {
        TagDataType.Bool => tag.GetBit(0) ? 1 : 0,
        TagDataType.Int => tag.GetInt16(0),
        TagDataType.Dint => tag.GetInt32(0),
        TagDataType.Real => tag.GetFloat32(0),
        // Unknown: best-effort. REAL and DINT are the same width; try REAL then fall back.
        _ => TryGetReal(tag),
    };

    private static double TryGetReal(Tag tag)
    {
        try { return tag.GetFloat32(0); }
        catch { return tag.GetInt32(0); }
    }

    private static string? FormatDisplay(double value, TagDataType dt) => dt switch
    {
        TagDataType.Bool => value > 0.5 ? "true" : "false",
        TagDataType.Int => ((short)value).ToString(),
        TagDataType.Dint => ((long)value).ToString(),
        TagDataType.Real => value.ToString("0.###"),
        TagDataType.String => "-",
        _ => value.ToString("0.###"),
    };

    private static void SetBool(Tag tag, TagDataType dt, bool value)
    {
        if (dt == TagDataType.Bool) tag.SetBit(0, value);
        else tag.SetInt32(0, value ? 1 : 0);
    }

    private static PlcType MapPlcKind(string kind) => (kind ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "controllogix" or "compactlogix" or "guardlogix" or "flexlogix" or "logix" => PlcType.ControlLogix,
        "micro800" or "micro820" or "micro850" or "micro870" => PlcType.Micro800,
        "micrologix" => PlcType.MicroLogix,
        "slc" or "slc500" => PlcType.Slc500,
        "plc5" => PlcType.Plc5,
        "omron" or "omronnjnx" or "nj" or "nx" => PlcType.Omron,
        _ => PlcType.ControlLogix,
    };

    /// <summary>Maps a Rockwell CIP type code to our primitive type for binding/validation.</summary>
    private static TagDataType MapAbType(ushort abType)
    {
        if ((abType & 0x8000) != 0) return TagDataType.Udt;
        return (abType & 0x00FF) switch
        {
            0xC1 => TagDataType.Bool, // BOOL
            0xC2 => TagDataType.Int,  // SINT (8-bit) - treated as Int
            0xC3 => TagDataType.Int,  // INT
            0xC4 => TagDataType.Dint, // DINT
            0xC5 => TagDataType.Dint, // LINT - narrowed to Dint for our purposes
            0xCA => TagDataType.Real, // REAL
            0xCB => TagDataType.Real, // LREAL
            0xD0 or 0xDA or 0xCE => TagDataType.String,
            _ => TagDataType.Unknown,
        };
    }

    public void Dispose()
    {
        foreach (var t in _readTags.Values) t.Dispose();
        foreach (var t in _writeTags.Values) t.Dispose();
        foreach (var t in _previewTags.Values) t.Dispose();
    }
}
