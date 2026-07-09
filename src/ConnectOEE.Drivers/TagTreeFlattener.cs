using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;

namespace ConnectOEE.Drivers;

/// <summary>
/// Flattens a browsed tag tree (with nested UDTs and arrays) into the flat
/// representations the historian/persistence layers use: a list of bindable leaf
/// tags with their flattened paths, and the distinct UDT type definitions with
/// their flattened member paths (see docs/08 "Flatten UDTs for historian storage").
/// </summary>
public static class TagTreeFlattener
{
    public record FlatTag(string Name, string FullPath, TagDataType DataType, string? UdtTypeName, int ArrayLength, string? Description);
    public record FlatUdtMember(string Name, string FlattenedPath, TagDataType DataType, int ArrayLength);
    public record FlatUdt(string TypeName, IReadOnlyList<FlatUdtMember> Members);

    /// <summary>Pre-order walk yielding every node in the tree.</summary>
    public static IEnumerable<BrowseTag> Walk(IEnumerable<BrowseTag> roots)
    {
        foreach (var node in roots)
        {
            yield return node;
            foreach (var child in Walk(node.Children))
                yield return child;
        }
    }

    /// <summary>All bindable leaf members (atomic tags / UDT members) as flat tags.</summary>
    public static IReadOnlyList<FlatTag> Leaves(IEnumerable<BrowseTag> roots) =>
        Walk(roots)
            .Where(n => n.Bindable)
            .Select(n => new FlatTag(n.Name, n.FullPath, n.DataType, n.UdtTypeName, n.ArrayLength, n.Description))
            .ToList();

    /// <summary>
    /// Distinct UDT type definitions discovered in the tree. Members are the immediate
    /// atomic fields of the first instance of each type, with paths flattened relative
    /// to the type root (e.g. "Status.Running").
    /// </summary>
    public static IReadOnlyList<FlatUdt> Udts(IEnumerable<BrowseTag> roots)
    {
        var result = new Dictionary<string, FlatUdt>(StringComparer.OrdinalIgnoreCase);
        foreach (var node in Walk(roots))
        {
            if (node.DataType != TagDataType.Udt || string.IsNullOrEmpty(node.UdtTypeName)) continue;
            if (result.ContainsKey(node.UdtTypeName)) continue;

            var members = new List<FlatUdtMember>();
            void Collect(BrowseTag t, string prefix)
            {
                foreach (var c in t.Children)
                {
                    var rel = string.IsNullOrEmpty(prefix) ? c.Name : $"{prefix}.{c.Name}";
                    members.Add(new FlatUdtMember(c.Name, rel, c.DataType, c.ArrayLength));
                    if (c.Children.Count > 0) Collect(c, rel);
                }
            }
            Collect(node, string.Empty);
            result[node.UdtTypeName] = new FlatUdt(node.UdtTypeName, members);
        }
        return result.Values.ToList();
    }
}
