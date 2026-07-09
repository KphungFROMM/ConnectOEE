using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;

namespace ConnectOEE.Drivers;

/// <summary>
/// Builds a realistic simulated controller tag namespace for the Mock driver so the
/// live tag browser (docs/09) is fully usable without hardware: controller-scoped
/// atomics, a program scope, a nested UDT instance, and a UDT array. Live values are
/// derived deterministically from the path + wall clock so previews move over time.
/// </summary>
public static class MockTagCatalog
{
    private static readonly Lazy<IReadOnlyList<BrowseTag>> _tree = new(BuildTree);
    private static readonly Lazy<IReadOnlyDictionary<string, BrowseTag>> _byPath = new(() =>
    {
        var map = new Dictionary<string, BrowseTag>(StringComparer.OrdinalIgnoreCase);
        void Walk(BrowseTag t)
        {
            map[t.FullPath] = t;
            foreach (var c in t.Children) Walk(c);
        }
        foreach (var t in _tree.Value) Walk(t);
        return map;
    });

    public static IReadOnlyList<BrowseTag> Tree => _tree.Value;

    /// <summary>Looks up a node by its fully-qualified path (case-insensitive).</summary>
    public static BrowseTag? Find(string path) => _byPath.Value.GetValueOrDefault(path);

    private static BrowseTag Leaf(string name, string path, TagDataType type, string? desc = null) =>
        new(name, path, type, null, 0, desc, Bindable: true, Array.Empty<BrowseTag>());

    private static IReadOnlyList<BrowseTag> BuildTree()
    {
        // ----- UDT instance: OEE_Data (nested Status_t + Counters_t) -----
        var status = new BrowseTag("Status", "OEE_Data.Status", TagDataType.Udt, "Status_t", 0,
            "Machine status word", Bindable: false, new[]
            {
                Leaf("Running", "OEE_Data.Status.Running", TagDataType.Bool, "Machine is running"),
                Leaf("Faulted", "OEE_Data.Status.Faulted", TagDataType.Bool, "Machine is faulted"),
                Leaf("Idle", "OEE_Data.Status.Idle", TagDataType.Bool, "Machine is idle"),
            });
        var counters = new BrowseTag("Counters", "OEE_Data.Counters", TagDataType.Udt, "Counters_t", 0,
            "Production counters", Bindable: false, new[]
            {
                Leaf("Good", "OEE_Data.Counters.Good", TagDataType.Dint, "Good parts"),
                Leaf("Reject", "OEE_Data.Counters.Reject", TagDataType.Dint, "Reject parts"),
                Leaf("Total", "OEE_Data.Counters.Total", TagDataType.Dint, "Total parts"),
            });
        var oeeData = new BrowseTag("OEE_Data", "OEE_Data", TagDataType.Udt, "OEE_Machine", 0,
            "OEE machine UDT", Bindable: false, new[]
            {
                status,
                counters,
                Leaf("Speed", "OEE_Data.Speed", TagDataType.Real, "Current rate (parts/hr)"),
                Leaf("FaultCode", "OEE_Data.FaultCode", TagDataType.Dint, "Active fault code"),
            });

        // ----- UDT array: Stations[0..3] of Station_t -----
        var stationElems = new List<BrowseTag>();
        for (var i = 0; i < 4; i++)
        {
            var idx = $"Stations[{i}]";
            stationElems.Add(new BrowseTag(idx, idx, TagDataType.Udt, "Station_t", 0,
                $"Station {i}", Bindable: false, new[]
                {
                    Leaf("Active", $"{idx}.Active", TagDataType.Bool, "Station active"),
                    Leaf("Count", $"{idx}.Count", TagDataType.Dint, "Station count"),
                    Leaf("Fault", $"{idx}.Fault", TagDataType.Dint, "Station fault code"),
                }));
        }
        var stations = new BrowseTag("Stations", "Stations", TagDataType.Array, "Station_t", 4,
            "Station array", Bindable: false, stationElems);

        // ----- Program scope -----
        var program = new BrowseTag("Program:MainProgram", "Program:MainProgram", TagDataType.Udt, null, 0,
            "Program-scoped tags", Bindable: false, new[]
            {
                Leaf("Cycle_Active", "Program:MainProgram.Cycle_Active", TagDataType.Bool, "Cycle in progress"),
                Leaf("Cycle_Count", "Program:MainProgram.Cycle_Count", TagDataType.Dint, "Completed cycles"),
                Leaf("Reject_Reason", "Program:MainProgram.Reject_Reason", TagDataType.Dint, "Last reject reason code"),
            });

        // ----- Controller-scoped atomics -----
        return new List<BrowseTag>
        {
            Leaf("Line_Running", "Line_Running", TagDataType.Bool, "Line run bit"),
            Leaf("Good_Count", "Good_Count", TagDataType.Dint, "Cumulative good parts"),
            Leaf("Reject_Count", "Reject_Count", TagDataType.Dint, "Cumulative reject parts"),
            Leaf("Total_Count", "Total_Count", TagDataType.Dint, "Cumulative total parts"),
            Leaf("Line_Speed", "Line_Speed", TagDataType.Real, "Current line speed (parts/hr)"),
            Leaf("Fault_Code", "Fault_Code", TagDataType.Dint, "Active fault code"),
            Leaf("Part_Id", "Part_Id", TagDataType.String, "Active part / SKU"),
            oeeData,
            stations,
            program,
        };
    }

    /// <summary>
    /// Produces a moving but stable live value for a path. Counts ramp with the time of
    /// day, bools oscillate, speed/real jitter around an ideal rate.
    /// </summary>
    public static TagValueSample Sample(string path, DateTimeOffset now)
    {
        var node = Find(path);
        var type = node?.DataType ?? InferType(path);
        var seed = StableHash(path);
        var rng = new Random(unchecked(seed ^ (int)(now.ToUnixTimeSeconds() / 5)));
        var minutes = now.TimeOfDay.TotalMinutes;

        double value;
        string display;
        switch (type)
        {
            case TagDataType.Bool:
                // Running-style bits sit mostly true; fault-style bits mostly false.
                var trueBias = path.Contains("Fault", StringComparison.OrdinalIgnoreCase) ? 0.08 : 0.9;
                value = rng.NextDouble() < trueBias ? 1 : 0;
                display = value > 0.5 ? "true" : "false";
                break;
            case TagDataType.Real:
                value = Math.Round(1500 + Math.Sin(minutes / 30.0) * 120 + rng.NextDouble() * 40 - 20, 1);
                display = value.ToString("0.0");
                break;
            case TagDataType.String:
                value = 0;
                display = $"SKU-{1000 + (seed & 0x1FF)}";
                break;
            case TagDataType.Int:
            case TagDataType.Dint:
                if (LooksLikeCount(path))
                {
                    // Monotonic-ish ramp through the day, offset per path.
                    value = Math.Floor(minutes * 25 + (seed & 0xFF));
                }
                else if (path.Contains("Fault", StringComparison.OrdinalIgnoreCase)
                         || path.Contains("Reason", StringComparison.OrdinalIgnoreCase))
                {
                    value = rng.NextDouble() < 0.85 ? 0 : 100 + rng.Next(0, 5);
                }
                else
                {
                    value = rng.Next(0, 100);
                }
                display = ((long)value).ToString();
                break;
            default:
                value = 0;
                display = "-";
                break;
        }

        return new TagValueSample(path, value, ValueQuality.Good, now, display);
    }

    private static bool LooksLikeCount(string path) =>
        path.Contains("Count", StringComparison.OrdinalIgnoreCase) ||
        path.Contains("Good", StringComparison.OrdinalIgnoreCase) ||
        path.Contains("Reject", StringComparison.OrdinalIgnoreCase) ||
        path.Contains("Total", StringComparison.OrdinalIgnoreCase);

    private static TagDataType InferType(string path)
    {
        if (path.Contains("Running", StringComparison.OrdinalIgnoreCase) ||
            path.Contains("Active", StringComparison.OrdinalIgnoreCase) ||
            path.Contains("Faulted", StringComparison.OrdinalIgnoreCase) ||
            path.Contains("Idle", StringComparison.OrdinalIgnoreCase))
            return TagDataType.Bool;
        if (path.Contains("Speed", StringComparison.OrdinalIgnoreCase)) return TagDataType.Real;
        if (path.Contains("Part_Id", StringComparison.OrdinalIgnoreCase)) return TagDataType.String;
        return TagDataType.Dint;
    }

    private static int StableHash(string s)
    {
        unchecked
        {
            var h = 23;
            foreach (var c in s) h = h * 31 + c;
            return h;
        }
    }
}
