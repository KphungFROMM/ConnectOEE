namespace ConnectOEE.Core.Abstractions;

/// <summary>
/// A node in a controller's tag namespace returned by tag browsing. Mirrors how a
/// Rockwell controller exposes controller/program tags, AOIs, UDTs and arrays:
/// container nodes (UDTs, arrays, scopes) carry <see cref="Children"/>, while leaf
/// nodes (atomic members) are <see cref="Bindable"/> to a logical signal.
/// </summary>
public record BrowseTag(
    string Name,
    string FullPath,
    TagDataType DataType,
    string? UdtTypeName,
    int ArrayLength,
    string? Description,
    bool Bindable,
    IReadOnlyList<BrowseTag> Children)
{
    /// <summary>Flattened historian path for this member (same as FullPath for atomics).</summary>
    public string FlattenedPath => FullPath;
}

/// <summary>A live value sample for a single tag path, carrying quality + timestamp.</summary>
public record TagValueSample(
    string FullPath,
    double Value,
    ValueQuality Quality,
    DateTimeOffset TimestampUtc,
    string? Display);

/// <summary>A tag path plus optional browse-time type hint for live preview reads.</summary>
public record TagReadRequest(string Path, TagDataType DataType = TagDataType.Unknown);

/// <summary>
/// Optional capability for drivers that can enumerate and live-read controller tags
/// (see docs/09). Drivers without browsing (or before connect) report
/// <see cref="SupportsBrowsing"/> = false and the UI falls back to manual tag entry.
/// </summary>
public interface ITagBrowsingDriver
{
    /// <summary>True when this driver can enumerate tags for a live browser.</summary>
    bool SupportsBrowsing { get; }

    /// <summary>Returns the controller tag namespace as a hierarchical tree.</summary>
    Task<IReadOnlyList<BrowseTag>> BrowseAsync(CancellationToken ct = default);

    /// <summary>Reads current values for the given fully-qualified tag paths.</summary>
    Task<IReadOnlyList<TagValueSample>> ReadValuesAsync(IEnumerable<TagReadRequest> requests, CancellationToken ct = default);
}
