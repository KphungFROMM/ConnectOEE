using System.Collections.Concurrent;
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
    private const int PcccMaxElementsPerFile = 256;
    /// <summary>MicroLogix/SLC data file numbers are 0–255.</summary>
    private const int PcccMaxFileNumber = 255;
    private const int PcccExistTimeoutMs = 400;
    private const int PcccProbeTimeoutMs = 800;
    private const int PcccDiscoverConcurrency = 2;
    private static readonly TimeSpan PcccBrowseCacheTtl = TimeSpan.FromSeconds(60);
    private static readonly ConcurrentDictionary<string, (DateTimeOffset At, IReadOnlyList<BrowseTag> Tags)> PcccBrowseCache = new(StringComparer.OrdinalIgnoreCase);

    private readonly RockwellConnectionOptions _opt;
    private readonly PlcType _plcType;
    private readonly DriverType _driverType;
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
        ILogger? logger = null,
        DriverType driverType = DriverType.RockwellEthernetIp)
    {
        _opt = options;
        _driverType = driverType.IsRockwell() ? driverType : DriverType.RockwellEthernetIp;
        _plcType = MapPlcKind(options.PlcKind);
        _signals = signals.ToList();
        _controls = (controls ?? Enumerable.Empty<RockwellControlBinding>()).ToList();
        _logger = logger ?? NullLogger.Instance;
    }

    public DriverType Type => _driverType;
    public ConnectionState State { get; private set; } = ConnectionState.Disconnected;
    /// <summary>
    /// Logix / Micro800: CIP <c>@tags</c>. MicroLogix: probe-synthesized PCCC data-table tree.
    /// SLC / PLC-5 stay manual until validated on hardware.
    /// </summary>
    public bool SupportsBrowsing => !IsPcccFamily || _plcType == PlcType.MicroLogix;
    public bool SupportsControl => _controls.Count > 0;

    private bool IsPcccFamily =>
        _plcType is PlcType.MicroLogix or PlcType.Slc500 or PlcType.Plc5;

    private bool IsMicro800 => _plcType == PlcType.Micro800;

    /// <summary>
    /// Logix needs a backplane path (e.g. 1,0). Micro800 must omit path.
    /// MicroLogix/SLC on embedded Ethernet omit path; keep only when bridging (DH+).
    /// </summary>
    private string? EffectivePath
    {
        get
        {
            if (IsMicro800)
                return null;
            var p = _opt.Path?.Trim();
            if (!IsPcccFamily)
                return string.IsNullOrEmpty(p) ? "1,0" : p;
            if (string.IsNullOrEmpty(p) || p is "1,0" or "0" or "1")
                return null;
            return p;
        }
    }

    public static string PlcKindFor(DriverType type) => type switch
    {
        DriverType.RockwellMicroLogix => "MicroLogix",
        DriverType.RockwellMicro800 => "Micro800",
        DriverType.RockwellEthernetIp => "ControlLogix",
        _ => "ControlLogix",
    };

    // ----- Lifecycle -----

    public async Task ConnectAsync(CancellationToken ct = default)
    {
        State = ConnectionState.Connecting;
        try
        {
            foreach (var group in _signals.GroupBy(s => s.TagPath, StringComparer.OrdinalIgnoreCase))
            {
                var path = group.Key;
                var dt = group.First().DataType;
                var tag = NewTag(path, dt);
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

    /// <summary>
    /// Lightweight reachability check. Logix uses <c>@tags</c>; MicroLogix/SLC/PLC-5
    /// have no CIP symbol service — probe by reading a common INT data file (<c>N7:0</c>).
    /// </summary>
    public async Task<(bool Ok, string Message, int TagCount)> ProbeAsync(CancellationToken ct = default)
    {
        if (IsPcccFamily)
            return await ProbePcccAsync(ct);

        try
        {
            var listing = new TagTagInfo
            {
                Gateway = _opt.Gateway,
                Path = EffectivePath,
                PlcType = _plcType,
                Protocol = Protocol.ab_eip,
                Name = "@tags",
                Timeout = TimeSpan.FromMilliseconds(Math.Max(_opt.TimeoutMs, 8000)),
            };
            await listing.ReadAsync(ct);
            var infos = listing.Value ?? Array.Empty<TagInfo>();
            listing.Dispose();
            var count = infos.Count(i => !string.IsNullOrEmpty(i.Name) && !i.Name.StartsWith("__", StringComparison.Ordinal));
            var kind = IsMicro800 ? "Micro800" : "Logix";
            var pathNote = EffectivePath is null ? "" : $" (path {EffectivePath})";
            return (true, $"Connected to {_opt.Gateway}{pathNote} ({kind}) — listed {count} controller tag(s).", count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Rockwell connection probe failed for {Gateway} ({Path})", _opt.Gateway, _opt.Path);
            return (false, $"Could not reach {_opt.Gateway}: {ex.Message}", 0);
        }
    }

    private async Task<(bool Ok, string Message, int TagCount)> ProbePcccAsync(CancellationToken ct)
    {
        // Prefer N7:0 (default integer file on most MicroLogix/SLC programs); fall back to B3:0.
        foreach (var probeName in new[] { "N7:0", "B3:0" })
        {
            Tag? tag = null;
            try
            {
                tag = NewTag(probeName, TagDataType.Int);
                tag.Timeout = TimeSpan.FromMilliseconds(Math.Max(_opt.TimeoutMs, 8000));
                await tag.InitializeAsync(ct);
                await tag.ReadAsync(ct);
                var value = tag.GetInt16(0);
                var kind = _plcType == PlcType.MicroLogix ? "MicroLogix" : _plcType.ToString();
                return (true, $"Connected to {_opt.Gateway} ({kind}) — read {probeName} = {value}. Use data-table paths (e.g. N7:0, B3:0/0) when mapping.", 1);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Rockwell PCCC probe {Name} failed for {Gateway}", probeName, _opt.Gateway);
                if (probeName == "B3:0")
                {
                    _logger.LogWarning(ex, "Rockwell connection probe failed for {Gateway}", _opt.Gateway);
                    return (false, $"Could not reach {_opt.Gateway}: {ex.Message}", 0);
                }
            }
            finally
            {
                tag?.Dispose();
            }
        }

        return (false, $"Could not reach {_opt.Gateway}.", 0);
    }

    public async Task<IReadOnlyList<BrowseTag>> BrowseAsync(
        CancellationToken ct = default,
        IProgress<BrowseProgress>? progress = null)
    {
        if (_plcType == PlcType.MicroLogix)
            return await BrowsePcccDataTablesAsync(ct, progress);

        if (IsPcccFamily)
        {
            progress?.Report(new BrowseProgress(100, "Browsing not available for this PLC type"));
            return Array.Empty<BrowseTag>();
        }

        progress?.Report(new BrowseProgress(5, "Listing controller tags…"));
        try
        {
            var listing = new TagTagInfo
            {
                Gateway = _opt.Gateway,
                Path = EffectivePath,
                PlcType = _plcType,
                Protocol = Protocol.ab_eip,
                Name = "@tags",
                Timeout = TimeSpan.FromMilliseconds(_opt.TimeoutMs),
            };
            await listing.ReadAsync(ct);
            var infos = listing.Value ?? Array.Empty<TagInfo>();
            listing.Dispose();

            progress?.Report(new BrowseProgress(40, "Expanding UDTs…"));
            var udtCache = new Dictionary<ushort, UdtInfo>();
            var result = new List<BrowseTag>();
            var usable = infos
                .Where(i => !string.IsNullOrEmpty(i.Name) && !i.Name.StartsWith("__", StringComparison.Ordinal))
                .ToList();
            for (var i = 0; i < usable.Count; i++)
            {
                ct.ThrowIfCancellationRequested();
                var info = usable[i];
                result.Add(await ToBrowseTagAsync(info.Name, info.Name, info.Type, info.Dimensions, udtCache, 0, ct));
                if (usable.Count > 0 && i % 5 == 0)
                {
                    var pct = 40 + (int)(55.0 * (i + 1) / usable.Count);
                    progress?.Report(new BrowseProgress(Math.Min(95, pct), $"Reading tags… ({i + 1}/{usable.Count})"));
                }
            }
            progress?.Report(new BrowseProgress(100, $"Found {result.Count} tag(s)"));
            return result.OrderBy(t => t.Name, StringComparer.OrdinalIgnoreCase).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Rockwell tag browse failed for {Gateway}", _opt.Gateway);
            progress?.Report(new BrowseProgress(100, "Browse failed"));
            return Array.Empty<BrowseTag>();
        }
    }

    /// <summary>
    /// MicroLogix has no CIP symbol service. Dynamically discover PCCC data files by
    /// probing file numbers 0–255 for each type, then synthesize a browse tree.
    /// </summary>
    private async Task<IReadOnlyList<BrowseTag>> BrowsePcccDataTablesAsync(
        CancellationToken ct,
        IProgress<BrowseProgress>? progress)
    {
        var cacheKey = $"{_opt.Gateway}|{_plcType}|{EffectivePath ?? ""}";
        if (PcccBrowseCache.TryGetValue(cacheKey, out var cached) &&
            DateTimeOffset.UtcNow - cached.At < PcccBrowseCacheTtl)
        {
            progress?.Report(new BrowseProgress(100, $"Cached — {cached.Tags.Count} data file(s)"));
            return cached.Tags;
        }

        var roots = new List<BrowseTag>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        progress?.Report(new BrowseProgress(2, "Reading I/O and status…"));
        // Discrete I/O first (Output file 0 / Input file 1). Extra slots = more words, not O2/I3.
        foreach (var firstWord in new[] { "O0:0", "I1:0" })
        {
            ct.ThrowIfCancellationRequested();
            var io = await TryBuildIoFileAsync(firstWord, ct);
            if (io is null || !seen.Add(io.Name)) continue;
            roots.Add(io);
        }

        // Status (always file 2) — libplctag form S2:n.
        {
            ct.ThrowIfCancellationRequested();
            var statusLen = await ProbePcccFileLengthAsync("S2", TagDataType.Int, ct);
            if (statusLen > 0 && seen.Add("S2"))
                roots.Add(BuildPcccFileNode("S2", statusLen, PcccFileShape.Integer));
        }

        progress?.Report(new BrowseProgress(5, "Scanning data files 0–255…"));
        var discovered = await DiscoverPcccTypedFilesAsync(ct, progress);
        var measureTotal = Math.Max(1, discovered.Count);
        var measureDone = 0;
        foreach (var (id, elementType, shape) in discovered.OrderBy(f => PcccBrowseSortKey(f.Id)))
        {
            ct.ThrowIfCancellationRequested();
            if (!seen.Add(id)) continue;
            var length = await ProbePcccFileLengthAsync(id, elementType, ct);
            measureDone++;
            if (length <= 0)
            {
                seen.Remove(id);
            }
            else
            {
                roots.Add(BuildPcccFileNode(id, length, shape));
            }

            var pct = 90 + (int)(9.0 * measureDone / measureTotal);
            progress?.Report(new BrowseProgress(
                Math.Min(99, pct),
                $"Measuring {id}… ({measureDone}/{discovered.Count})"));
        }

        var ordered = roots
            .OrderBy(t => PcccBrowseSortKey(t.Name), StringComparer.OrdinalIgnoreCase)
            .ToList();
        PcccBrowseCache[cacheKey] = (DateTimeOffset.UtcNow, ordered);
        progress?.Report(new BrowseProgress(100, $"Found {ordered.Count} data file(s)"));
        _logger.LogInformation(
            "MicroLogix data-table discovery on {Gateway}: {FileCount} file(s)",
            _opt.Gateway, ordered.Count);
        return ordered;
    }

    private static readonly (string Prefix, TagDataType ElementType, PcccFileShape Shape)[] PcccTypedFileKinds =
    [
        ("B", TagDataType.Int, PcccFileShape.Binary),
        ("T", TagDataType.Int, PcccFileShape.Timer),
        ("C", TagDataType.Int, PcccFileShape.Counter),
        ("R", TagDataType.Int, PcccFileShape.Control),
        ("N", TagDataType.Int, PcccFileShape.Integer),
        ("F", TagDataType.Real, PcccFileShape.Float),
        ("MG", TagDataType.Int, PcccFileShape.Message),
        ("ST", TagDataType.Int, PcccFileShape.Integer),
        ("L", TagDataType.Dint, PcccFileShape.Integer),
    ];

    /// <summary>
    /// Existence scan across file numbers 0–255 for each PCCC type. Only checks element 0
    /// (or MG:0.EN); length is measured afterward for hits only.
    /// </summary>
    private async Task<List<(string Id, TagDataType ElementType, PcccFileShape Shape)>> DiscoverPcccTypedFilesAsync(
        CancellationToken ct,
        IProgress<BrowseProgress>? progress)
    {
        var found = new ConcurrentBag<(string Id, TagDataType ElementType, PcccFileShape Shape)>();
        using var gate = new SemaphoreSlim(PcccDiscoverConcurrency);
        var total = PcccTypedFileKinds.Length * (PcccMaxFileNumber + 1);
        var completed = 0;
        var tasks = new List<Task>(total);

        foreach (var (prefix, elementType, shape) in PcccTypedFileKinds)
        {
            for (var n = 0; n <= PcccMaxFileNumber; n++)
            {
                var fileId = $"{prefix}{n}";
                var dt = elementType;
                var fileShape = shape;
                tasks.Add(Task.Run(async () =>
                {
                    await gate.WaitAsync(ct).ConfigureAwait(false);
                    try
                    {
                        if (await PcccFileExistsAsync(fileId, dt, fileShape, ct).ConfigureAwait(false))
                            found.Add((fileId, dt, fileShape));
                    }
                    finally
                    {
                        var done = Interlocked.Increment(ref completed);
                        if (done == total || done % 32 == 0)
                        {
                            var pct = 5 + (int)(85.0 * done / total);
                            progress?.Report(new BrowseProgress(
                                Math.Min(90, pct),
                                $"Scanning data files… {done:N0} / {total:N0}"));
                        }
                        gate.Release();
                    }
                }, ct));
            }
        }

        await Task.WhenAll(tasks).ConfigureAwait(false);
        return found.ToList();
    }

    private async Task<bool> PcccFileExistsAsync(
        string fileId, TagDataType elementType, PcccFileShape shape, CancellationToken ct)
    {
        if (await TryReadPcccAsync($"{fileId}:0", elementType, ct, PcccExistTimeoutMs).ConfigureAwait(false))
            return true;
        if (shape == PcccFileShape.Message &&
            await TryReadPcccAsync($"{fileId}:0.EN", TagDataType.Bool, ct, PcccExistTimeoutMs).ConfigureAwait(false))
            return true;
        return false;
    }

    private static string PcccBrowseSortKey(string name)
    {
        if (name.Length >= 2 && (name[0] is 'O' or 'o') && char.IsDigit(name[1]))
            return "0|" + PadFileNumber(name);
        if (name.Length >= 2 && (name[0] is 'I' or 'i') && char.IsDigit(name[1]))
            return "1|" + PadFileNumber(name);
        if (name.Equals("S2", StringComparison.OrdinalIgnoreCase) ||
            (name.StartsWith("S2", StringComparison.OrdinalIgnoreCase) && name.Length > 2 && char.IsDigit(name[2])))
            return "2|" + name;
        return "3|" + PadFileNumber(name);
    }

    private static string PadFileNumber(string name)
    {
        var i = 0;
        while (i < name.Length && !char.IsDigit(name[i])) i++;
        if (i >= name.Length || !int.TryParse(name.AsSpan(i), out var num))
            return name;
        return name[..i] + num.ToString("D3");
    }

    private async Task<BrowseTag?> TryBuildIoFileAsync(string firstWord, CancellationToken ct)
    {
        // I/O needs a slightly longer timeout than the mass existence scan.
        var wordOk = await TryReadPcccAsync(firstWord, TagDataType.Int, ct, PcccProbeTimeoutMs);
        if (!wordOk && !await TryReadPcccAsync($"{firstWord}/0", TagDataType.Bool, ct, PcccProbeTimeoutMs))
            return null;

        var colon = firstWord.IndexOf(':');
        if (colon <= 0) return null;
        var filePrefix = firstWord[..colon];
        var start = int.TryParse(firstWord[(colon + 1)..], out var s) ? s : 0;

        var words = new List<string> { firstWord };
        for (var w = start + 1; w <= start + 16; w++)
        {
            var path = $"{filePrefix}:{w}";
            if (!await TryReadPcccAsync(path, TagDataType.Int, ct, PcccExistTimeoutMs) &&
                !await TryReadPcccAsync($"{path}/0", TagDataType.Bool, ct, PcccExistTimeoutMs))
                break;
            words.Add(path);
        }

        var children = new List<BrowseTag>();
        foreach (var word in words)
        {
            var bits = new List<BrowseTag>(16);
            for (var b = 0; b < 16; b++)
            {
                var bitPath = $"{word}/{b}";
                bits.Add(new BrowseTag($"{word}/{b}", bitPath, TagDataType.Bool, null, 0, null, true, Array.Empty<BrowseTag>()));
            }
            children.Add(new BrowseTag(word, word, TagDataType.Int, null, 0, null, true, bits));
        }

        return new BrowseTag(filePrefix, firstWord, TagDataType.Int, null, words.Count, null, false, children);
    }

    private enum PcccFileShape { Integer, Float, Binary, Timer, Counter, Control, Message }

    private BrowseTag BuildPcccFileNode(string fileId, int length, PcccFileShape shape, string? displayName = null)
    {
        var children = new List<BrowseTag>(length);
        for (var i = 0; i < length; i++)
        {
            var elemPath = $"{fileId}:{i}";
            children.Add(shape switch
            {
                PcccFileShape.Binary => BuildBinaryElement(elemPath, i),
                PcccFileShape.Timer => BuildStructuredElement(elemPath, i, TimerFields),
                PcccFileShape.Counter => BuildStructuredElement(elemPath, i, CounterFields),
                PcccFileShape.Control => BuildStructuredElement(elemPath, i, ControlFields),
                PcccFileShape.Message => BuildStructuredElement(elemPath, i, MessageFields),
                PcccFileShape.Float => new BrowseTag(
                    $"{fileId}:{i}", elemPath, TagDataType.Real, null, 0, null, true, Array.Empty<BrowseTag>()),
                _ => new BrowseTag(
                    $"{fileId}:{i}", elemPath, TagDataType.Int, null, 0, null, true, Array.Empty<BrowseTag>()),
            });
        }

        var rootType = shape switch
        {
            PcccFileShape.Float => TagDataType.Real,
            PcccFileShape.Binary => TagDataType.Bool,
            _ => TagDataType.Int,
        };
        var name = displayName ?? fileId;
        return new BrowseTag(name, fileId, rootType, null, length, $"{length} element(s)", false, children);
    }

    private static readonly (string Name, TagDataType Type)[] TimerFields =
    [
        ("PRE", TagDataType.Int), ("ACC", TagDataType.Int),
        ("EN", TagDataType.Bool), ("TT", TagDataType.Bool), ("DN", TagDataType.Bool),
    ];

    private static readonly (string Name, TagDataType Type)[] CounterFields =
    [
        ("PRE", TagDataType.Int), ("ACC", TagDataType.Int),
        ("CU", TagDataType.Bool), ("CD", TagDataType.Bool),
        ("DN", TagDataType.Bool), ("OV", TagDataType.Bool), ("UN", TagDataType.Bool),
    ];

    private static readonly (string Name, TagDataType Type)[] ControlFields =
    [
        ("LEN", TagDataType.Int), ("POS", TagDataType.Int),
        ("EN", TagDataType.Bool), ("DN", TagDataType.Bool), ("ER", TagDataType.Bool),
        ("UL", TagDataType.Bool), ("IN", TagDataType.Bool), ("FD", TagDataType.Bool),
    ];

    private static readonly (string Name, TagDataType Type)[] MessageFields =
    [
        ("EN", TagDataType.Bool), ("DN", TagDataType.Bool), ("ER", TagDataType.Bool),
        ("TO", TagDataType.Bool), ("EW", TagDataType.Bool), ("CO", TagDataType.Bool),
        ("EA", TagDataType.Bool),
    ];

    private static BrowseTag BuildBinaryElement(string elemPath, int index)
    {
        var bits = new List<BrowseTag>(16);
        for (var b = 0; b < 16; b++)
        {
            var bitPath = $"{elemPath}/{b}";
            bits.Add(new BrowseTag($"{elemPath}/{b}", bitPath, TagDataType.Bool, null, 0, null, true, Array.Empty<BrowseTag>()));
        }
        return new BrowseTag(elemPath, elemPath, TagDataType.Int, null, 0, $"Word {index}", true, bits);
    }

    private static BrowseTag BuildStructuredElement(string elemPath, int index, (string Name, TagDataType Type)[] fields)
    {
        var children = fields
            .Select(f =>
            {
                var path = $"{elemPath}.{f.Name}";
                return new BrowseTag(f.Name, path, f.Type, null, 0, null, true, Array.Empty<BrowseTag>());
            })
            .ToList();
        return new BrowseTag(elemPath, elemPath, TagDataType.Int, null, 0, $"Element {index}", false, children);
    }

    private async Task<int> ProbePcccFileLengthAsync(string fileId, TagDataType elementType, CancellationToken ct)
    {
        var zeroPath = $"{fileId}:0";
        if (!await TryReadPcccAsync(zeroPath, elementType, ct))
        {
            if (fileId.StartsWith("MG", StringComparison.OrdinalIgnoreCase) &&
                await TryReadPcccAsync($"{fileId}:0.EN", TagDataType.Bool, ct))
                return await ProbeStructuredFileLengthAsync(fileId, ct);
            return 0;
        }

        var lo = 0;
        var hi = PcccMaxElementsPerFile - 1;
        while (lo < hi)
        {
            ct.ThrowIfCancellationRequested();
            var mid = (lo + hi + 1) / 2;
            if (await TryReadPcccAsync($"{fileId}:{mid}", elementType, ct))
                lo = mid;
            else
                hi = mid - 1;
        }
        return lo + 1;
    }

    private async Task<int> ProbeStructuredFileLengthAsync(string fileId, CancellationToken ct)
    {
        var lo = 0;
        var hi = Math.Min(PcccMaxElementsPerFile, 32) - 1;
        while (lo < hi)
        {
            ct.ThrowIfCancellationRequested();
            var mid = (lo + hi + 1) / 2;
            if (await TryReadPcccAsync($"{fileId}:{mid}.EN", TagDataType.Bool, ct))
                lo = mid;
            else
                hi = mid - 1;
        }
        return lo + 1;
    }

    private Task<bool> TryReadPcccAsync(string path, TagDataType dataType, CancellationToken ct)
        => TryReadPcccAsync(path, dataType, ct, PcccProbeTimeoutMs);

    private async Task<bool> TryReadPcccAsync(string path, TagDataType dataType, CancellationToken ct, int timeoutMs)
    {
        Tag? tag = null;
        try
        {
            tag = NewTag(path, dataType);
            tag.Timeout = TimeSpan.FromMilliseconds(timeoutMs);
            await tag.InitializeAsync(ct);
            await tag.ReadAsync(ct);
            return true;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch
        {
            return false;
        }
        finally
        {
            tag?.Dispose();
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
            if (dataType == TagDataType.Unknown)
                dataType = InferPcccDataType(path);
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

    /// <summary>
    /// CIP Logix symbol type: bits 14–13 = array rank (0–3). libplctag always returns three
    /// dimension words; scalars often look like <c>[0,0,0]</c> or <c>[1,0,0]</c>, so we only
    /// treat a tag as an array when the type word says it has dimensions.
    /// </summary>
    private static int ArrayLengthFromDims(ushort abType, uint[]? dims)
    {
        var dimCount = (abType >> 13) & 0x3;
        if (dimCount == 0 || dims is null || dims.Length == 0) return 0;

        uint product = 1;
        var used = 0;
        foreach (var d in dims)
        {
            if (used >= dimCount) break;
            // Rank says this slot is a real dimension; treat 0 as 1 to avoid wiping the product.
            product *= d == 0 ? 1u : d;
            used++;
        }
        return used == 0 ? 0 : (int)product;
    }

    private async Task<BrowseTag> ToBrowseTagAsync(
        string name, string fullPath, ushort abType, uint[]? dims,
        Dictionary<ushort, UdtInfo> udtCache, int depth, CancellationToken ct)
    {
        var arrayLength = ArrayLengthFromDims(abType, dims);
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
        var typeLabel = CipTypeLabel(abType);
        return new BrowseTag(name, fullPath, arrayLength > 0 ? TagDataType.Array : dataType, null, arrayLength, typeLabel,
            Bindable: arrayLength == 0 && dataType != TagDataType.Unknown, Array.Empty<BrowseTag>());
    }

    private static string? CipTypeLabel(ushort abType)
    {
        if ((abType & 0x8000) != 0) return null;
        return (abType & 0x00FF) switch
        {
            0xC1 => "BOOL",
            0xC2 => "SINT",
            0xC3 => "INT",
            0xC4 => "DINT",
            0xC5 => "LINT",
            0xC6 => "USINT",
            0xC7 => "UINT",
            0xC8 => "UDINT",
            0xC9 => "ULINT",
            0xCA => "REAL",
            0xCB => "LREAL",
            0xD2 => "WORD",
            0xD3 => "DWORD",
            0xDB => "TIME",
            0xD7 => "LTIME",
            0xD6 => "FTIME",
            0xD8 => "ITIME",
            0xD0 or 0xDA => "STRING",
            _ => null,
        };
    }

    private async Task<UdtInfo?> GetUdtAsync(ushort udtId, Dictionary<ushort, UdtInfo> cache, CancellationToken ct)
    {
        if (cache.TryGetValue(udtId, out var cached)) return cached;
        try
        {
            var udtTag = new TagUdtInfo
            {
                Gateway = _opt.Gateway,
                Path = EffectivePath,
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

    private Tag NewTag(string name, TagDataType? dataType = null)
    {
        var tag = new Tag
        {
            Name = name,
            Gateway = _opt.Gateway,
            Path = EffectivePath,
            PlcType = _plcType,
            Protocol = Protocol.ab_eip,
            Timeout = TimeSpan.FromMilliseconds(_opt.TimeoutMs),
            ReadCacheMillisecondDuration = _opt.ReadCacheMs,
        };

        // PCCC (MicroLogix/SLC/PLC-5) requires elem_size; Logix CIP tags infer size from type.
        if (IsPcccFamily)
        {
            var dt = dataType ?? InferPcccDataType(name);
            tag.ElementSize = ElementSizeBytes(dt);
            tag.ElementCount = 1;
        }

        return tag;
    }

    private static int ElementSizeBytes(TagDataType dt) => dt switch
    {
        TagDataType.Real => 4,
        TagDataType.Dint => 4,
        _ => 2, // INT / BOOL bit-in-word
    };

    /// <summary>Guess PCCC element size / type from classic data-table address (N7:, F8:, B3:0/2, T4:0.ACC, …).</summary>
    private static TagDataType InferPcccDataType(string path)
    {
        var p = path.Trim();
        if (p.Contains('/', StringComparison.Ordinal))
            return TagDataType.Bool;

        var dot = p.LastIndexOf('.');
        if (dot >= 0 && dot < p.Length - 1)
        {
            var field = p[(dot + 1)..];
            if (field.Equals("EN", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("TT", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("DN", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("CU", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("CD", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("OV", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("UN", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("UA", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("EU", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("EM", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("ER", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("UL", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("IN", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("FD", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("TO", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("EW", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("CO", StringComparison.OrdinalIgnoreCase) ||
                field.Equals("EA", StringComparison.OrdinalIgnoreCase))
                return TagDataType.Bool;
            return TagDataType.Int; // PRE, ACC, LEN, POS, …
        }

        if (p.StartsWith("F", StringComparison.OrdinalIgnoreCase))
            return TagDataType.Real;
        if (p.StartsWith("L", StringComparison.OrdinalIgnoreCase))
            return TagDataType.Dint;
        // B3:0 (word) is INT; only B3:0/n is BOOL (handled above).
        return TagDataType.Int;
    }

    private Tag GetWriteTag(string path)
    {
        if (_writeTags.TryGetValue(path, out var existing)) return existing;
        var dt = _controls.FirstOrDefault(c => string.Equals(c.TagPath, path, StringComparison.OrdinalIgnoreCase))?.DataType
                 ?? InferPcccDataType(path);
        var tag = NewTag(path, dt);
        tag.Initialize();
        _writeTags[path] = tag;
        return tag;
    }

    private async Task<Tag> GetPreviewTagAsync(string path, CancellationToken ct)
    {
        if (_previewTags.TryGetValue(path, out var existing)) return existing;
        var dt = FindDataType(path);
        if (dt == TagDataType.Unknown) dt = InferPcccDataType(path);
        var tag = NewTag(path, dt);
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
        TagDataType.UInt => tag.GetUInt16(0),
        TagDataType.Dint => ReadDintFlexible(tag),
        TagDataType.Time => tag.GetInt32(0),
        TagDataType.Real => tag.GetFloat32(0),
        // Unknown: best-effort. REAL and DINT are the same width; try REAL then fall back.
        _ => TryGetReal(tag),
    };

    /// <summary>DINT or UDINT — try signed then unsigned 32-bit.</summary>
    private static double ReadDintFlexible(Tag tag)
    {
        try { return tag.GetInt32(0); }
        catch
        {
            try { return tag.GetUInt32(0); }
            catch { return tag.GetUInt16(0); }
        }
    }

    private static double TryGetReal(Tag tag)
    {
        try { return tag.GetFloat32(0); }
        catch { return tag.GetInt32(0); }
    }

    private static string? FormatDisplay(double value, TagDataType dt) => dt switch
    {
        TagDataType.Bool => value > 0.5 ? "true" : "false",
        TagDataType.Int => ((short)value).ToString(),
        TagDataType.UInt => ((ushort)Math.Clamp(value, 0, ushort.MaxValue)).ToString(),
        TagDataType.Dint => ((long)value).ToString(),
        TagDataType.Time => FormatTimeMs((long)value),
        TagDataType.Real => value.ToString("0.###"),
        TagDataType.String => "-",
        _ => value.ToString("0.###"),
    };

    /// <summary>Format CIP TIME (ms) similar to Connected Components: T#5m, T#1s500ms, …</summary>
    private static string FormatTimeMs(long ms)
    {
        if (ms < 0) return ms.ToString();
        var span = TimeSpan.FromMilliseconds(ms);
        if (span.TotalDays >= 1)
            return $"T#{(int)span.TotalDays}d{span.Hours}h{span.Minutes}m";
        if (span.TotalHours >= 1)
            return $"T#{(int)span.TotalHours}h{span.Minutes}m{span.Seconds}s";
        if (span.TotalMinutes >= 1)
            return span.Seconds == 0 ? $"T#{(int)span.TotalMinutes}m" : $"T#{(int)span.TotalMinutes}m{span.Seconds}s";
        if (span.TotalSeconds >= 1)
            return span.Milliseconds == 0 ? $"T#{(int)span.TotalSeconds}s" : $"T#{(int)span.TotalSeconds}s{span.Milliseconds}ms";
        return $"T#{ms}ms";
    }

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
            0xC1 => TagDataType.Bool,   // BOOL
            0xC2 => TagDataType.Int,    // SINT
            0xC3 => TagDataType.Int,    // INT
            0xC4 => TagDataType.Dint,   // DINT
            0xC5 => TagDataType.Dint,   // LINT (narrowed)
            0xC6 => TagDataType.Int,    // USINT
            0xC7 => TagDataType.UInt,   // UINT
            0xC8 => TagDataType.Dint,   // UDINT (read via flexible DINT)
            0xC9 => TagDataType.Dint,   // ULINT (narrowed)
            0xCA => TagDataType.Real,   // REAL
            0xCB => TagDataType.Real,   // LREAL
            0xCC => TagDataType.Dint,   // STIME
            0xCD => TagDataType.Dint,   // DATE
            0xCE => TagDataType.String, // TIME_OF_DAY (display as string when possible)
            0xCF => TagDataType.Dint,   // DATE_AND_TIME
            0xD0 or 0xDA or 0xD5 or 0xD9 or 0xDE => TagDataType.String,
            0xD1 => TagDataType.Int,    // BYTE
            0xD2 => TagDataType.UInt,   // WORD — Micro800 embedded analog I/O
            0xD3 => TagDataType.Dint,   // DWORD
            0xD4 => TagDataType.Dint,   // LWORD
            0xD6 => TagDataType.Time,   // FTIME
            0xD7 => TagDataType.Time,   // LTIME
            0xD8 => TagDataType.Int,    // ITIME
            0xDB => TagDataType.Time,   // TIME (ms) — e.g. TON preset
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
