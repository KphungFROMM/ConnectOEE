using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;

namespace ConnectOEE.Drivers;

/// <summary>
/// Simulator driver: ships first so the whole system runs without hardware.
/// Each machine runs a simple state machine - mostly Running, with occasional
/// breakdowns (fault code) and short micro-stops - while counts accrue at the
/// ideal rate with a small reject fraction and speed jitter.
/// </summary>
public class MockDriver : IPlcDriver, ITagBrowsingDriver, IControllableDriver
{
    private sealed class Sim
    {
        public required DriverMachine Machine;
        public RunState State = RunState.Running;
        public double GoodAccum;       // fractional accumulator for parts
        public long GoodCount;
        public long RejectCount;
        public int? FaultCode;
        public DateTimeOffset StateUntil = DateTimeOffset.UtcNow;
        public double CurrentSpeed;
        public bool StartPermissive = true;
        public int AckPulseCount;
        public int ResetPulseCount;
    }

    private readonly List<Sim> _sims;
    private readonly HashSet<Guid> _partIdMachines;
    private readonly Dictionary<string, double> _tagWrites = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _gate = new();
    private readonly Random _rng = new();
    private DateTimeOffset _lastPoll = DateTimeOffset.UtcNow;
    private static readonly string[] DemoProducts = { "WGT-A100", "WGT-B200", "PKG-STD", "PKG-PREM", "SPC-500" };
    private int _productIndex;
    private DateTimeOffset _productRotatedAt = DateTimeOffset.UtcNow;

    public DriverType Type => DriverType.Mock;
    public ConnectionState State { get; private set; } = ConnectionState.Disconnected;
    public bool SupportsControl => true;

    public MockDriver(IEnumerable<DriverMachine> machines, IEnumerable<Guid>? partIdMachineIds = null)
    {
        _partIdMachines = partIdMachineIds?.ToHashSet() ?? new HashSet<Guid>();
        _sims = machines.Select(m => new Sim { Machine = m, CurrentSpeed = m.IdealRatePerHour }).ToList();
    }

    // ----- ITagBrowsingDriver (live tag browser, docs/09) -----
    // The simulator exposes a realistic controller namespace so the browser, UDT
    // tree, and tag mapping are fully exercisable without hardware.
    public bool SupportsBrowsing => true;

    public Task<IReadOnlyList<BrowseTag>> BrowseAsync(
        CancellationToken ct = default,
        IProgress<BrowseProgress>? progress = null)
    {
        progress?.Report(new BrowseProgress(100, "Ready"));
        return Task.FromResult(MockTagCatalog.Tree);
    }

    public Task<IReadOnlyList<TagValueSample>> ReadValuesAsync(IEnumerable<TagReadRequest> requests, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var samples = requests
            .Where(r => !string.IsNullOrWhiteSpace(r.Path))
            .GroupBy(r => r.Path.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g => MockTagCatalog.Sample(g.Key, now))
            .ToList();
        return Task.FromResult<IReadOnlyList<TagValueSample>>(samples);
    }

    public Task ConnectAsync(CancellationToken ct = default)
    {
        State = ConnectionState.Connected;
        _lastPoll = DateTimeOffset.UtcNow;
        return Task.CompletedTask;
    }

    public Task DisconnectAsync(CancellationToken ct = default)
    {
        State = ConnectionState.Disconnected;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<SignalReading>> PollAsync(CancellationToken ct = default)
    {
        lock (_gate)
        {
            var now = DateTimeOffset.UtcNow;
            var elapsedHours = (now - _lastPoll).TotalHours;
            _lastPoll = now;

            var readings = new List<SignalReading>(_sims.Count * 4);

            foreach (var sim in _sims)
            {
                AdvanceState(sim, now);

                if (sim.State == RunState.Running)
                {
                    // Accrue production at ideal rate with mild speed variation.
                    sim.CurrentSpeed = sim.Machine.IdealRatePerHour * (0.9 + _rng.NextDouble() * 0.15);
                    sim.GoodAccum += sim.CurrentSpeed * elapsedHours;
                    var whole = (long)Math.Floor(sim.GoodAccum);
                    if (whole > 0)
                    {
                        sim.GoodAccum -= whole;
                        // ~2% rejects.
                        var rejects = 0L;
                        for (var i = 0; i < whole; i++)
                            if (_rng.NextDouble() < 0.02) rejects++;
                        sim.GoodCount += whole - rejects;
                        sim.RejectCount += rejects;
                    }
                }
                else
                {
                    sim.CurrentSpeed = 0;
                }

                readings.Add(new SignalReading(sim.Machine.MachineId, sim.Machine.LineId, SignalRole.RunState,
                    (double)(int)sim.State, sim.State, sim.FaultCode, now));
                readings.Add(new SignalReading(sim.Machine.MachineId, sim.Machine.LineId, SignalRole.GoodCount,
                    sim.GoodCount, null, null, now));
                readings.Add(new SignalReading(sim.Machine.MachineId, sim.Machine.LineId, SignalRole.RejectCount,
                    sim.RejectCount, null, null, now));
                readings.Add(new SignalReading(sim.Machine.MachineId, sim.Machine.LineId, SignalRole.Speed,
                    sim.CurrentSpeed, null, null, now));
                readings.Add(new SignalReading(sim.Machine.MachineId, sim.Machine.LineId, SignalRole.DowntimeReason,
                    sim.FaultCode ?? 0, null, sim.FaultCode, now));

                // Emit rotating demo PartId only when the machine has a PartId tag mapping (see DriverFactory).
                if (_partIdMachines.Contains(sim.Machine.MachineId))
                {
                    if ((now - _productRotatedAt).TotalMinutes >= 8)
                    {
                        _productIndex = (_productIndex + 1) % DemoProducts.Length;
                        _productRotatedAt = now;
                    }
                    readings.Add(new SignalReading(sim.Machine.MachineId, sim.Machine.LineId, SignalRole.PartId,
                        0, null, null, now, TextValue: DemoProducts[_productIndex]));
                }
            }

            return Task.FromResult<IReadOnlyList<SignalReading>>(readings);
        }
    }

    private void AdvanceState(Sim sim, DateTimeOffset now)
    {
        if (now < sim.StateUntil) return;

        // Transition logic: from Running we may break down or micro-stop.
        // StartPermissive held false blocks auto-recovery from Idle/Down.
        switch (sim.State)
        {
            case RunState.Running:
                var roll = _rng.NextDouble();
                if (roll < 0.05)
                {
                    sim.State = RunState.Down;
                    sim.FaultCode = 100 + _rng.Next(0, 5); // 100..104
                    sim.StateUntil = now.AddSeconds(_rng.Next(20, 120)); // breakdown
                }
                else if (roll < 0.12)
                {
                    sim.State = RunState.Idle;
                    sim.FaultCode = null;
                    sim.StateUntil = now.AddSeconds(_rng.Next(5, 30)); // micro/idle stop
                }
                else
                {
                    sim.StateUntil = now.AddSeconds(_rng.Next(30, 90)); // keep running
                }
                break;

            default:
                if (!sim.StartPermissive)
                {
                    sim.StateUntil = now.AddSeconds(_rng.Next(10, 40));
                    break;
                }
                sim.State = RunState.Running;
                sim.FaultCode = null;
                sim.StateUntil = now.AddSeconds(_rng.Next(30, 120));
                break;
        }
    }

    // ----- IControllableDriver (commission without Rockwell hardware) -----

    public Task<bool> WriteCommandAsync(Guid machineId, PlcCommand command, CancellationToken ct = default)
    {
        lock (_gate)
        {
            var sim = _sims.FirstOrDefault(s => s.Machine.MachineId == machineId);
            if (sim is null) return Task.FromResult(false);

            switch (command)
            {
                case PlcCommand.Ack:
                    // Pulse ack and clear fault latch → Running (mirrors Rockwell pulse).
                    sim.AckPulseCount++;
                    sim.FaultCode = null;
                    if (sim.State is RunState.Down or RunState.Setup)
                    {
                        sim.State = RunState.Running;
                        sim.StateUntil = DateTimeOffset.UtcNow.AddSeconds(30);
                    }
                    break;
                case PlcCommand.Reset:
                    sim.ResetPulseCount++;
                    sim.FaultCode = null;
                    sim.State = RunState.Idle;
                    sim.StateUntil = DateTimeOffset.UtcNow.AddSeconds(5);
                    break;
                case PlcCommand.StartPermissive:
                    // Hold enable bit (PLC owns interlocks; mock just latches the bit).
                    sim.StartPermissive = true;
                    break;
                default:
                    return Task.FromResult(false);
            }

            _tagWrites[$"Mock.Control.{machineId:N}.{command}"] = 1;
            return Task.FromResult(true);
        }
    }

    public Task<bool> WriteTagAsync(string tagPath, double value, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(tagPath)) return Task.FromResult(false);
        lock (_gate)
        {
            _tagWrites[tagPath.Trim()] = value;
        }
        return Task.FromResult(true);
    }
}
