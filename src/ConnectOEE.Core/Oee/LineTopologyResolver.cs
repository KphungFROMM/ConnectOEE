using ConnectOEE.Core.Entities;

namespace ConnectOEE.Core.Oee;

/// <summary>Resolved Continuous/Independent topology for a line.</summary>
public readonly record struct LineTopologyResolution(
    LineTopology Topology,
    Guid? OutputMachineId,
    Guid? PacingMachineId);

/// <summary>Resolves output/pacing machine ids for line rollups.</summary>
public static class LineTopologyResolver
{
    /// <summary>
    /// Machines must be ordered by SequenceIndex ascending.
    /// Continuous with no explicit output → last machine; pacing defaults to output.
    /// </summary>
    public static LineTopologyResolution Resolve(
        LineTopology topology,
        Guid? configuredOutputId,
        Guid? configuredPacingId,
        IReadOnlyList<Guid> machinesBySequence)
    {
        if (topology != LineTopology.Continuous || machinesBySequence.Count == 0)
            return new LineTopologyResolution(topology, null, null);

        Guid? output = configuredOutputId;
        if (output is null || !machinesBySequence.Contains(output.Value))
            output = machinesBySequence[^1];

        Guid? pacing = configuredPacingId;
        if (pacing is null || !machinesBySequence.Contains(pacing.Value))
            pacing = output;

        return new LineTopologyResolution(LineTopology.Continuous, output, pacing);
    }

    public static LineTopologyResolution FromConfig(
        OeeConfig? cfg,
        IReadOnlyList<Guid> machinesBySequence)
        => Resolve(
            cfg?.Topology ?? LineTopology.Independent,
            cfg?.LineOutputMachineId,
            cfg?.PacingMachineId,
            machinesBySequence);
}
