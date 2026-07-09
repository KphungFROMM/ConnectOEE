namespace ConnectOEE.Api.Live;

public record IngestResult(
    IReadOnlyList<MachineSnapshot> Snapshots,
    IReadOnlyList<Guid> RecipeChangedLineIds);
