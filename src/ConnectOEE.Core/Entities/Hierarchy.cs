using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>Base for entities with a surrogate Guid key and audit timestamps.</summary>
public abstract class EntityBase
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedUtc { get; set; }
}

public class Plant : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(50)]
    public string? Code { get; set; }
    /// <summary>IANA/Windows time zone id used to resolve shifts in local time.</summary>
    [MaxLength(100)]
    public string TimeZoneId { get; set; } = "UTC";
    [MaxLength(500)]
    public string? Location { get; set; }

    public List<Department> Departments { get; set; } = new();
}

public class Department : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public Guid PlantId { get; set; }
    public Plant? Plant { get; set; }

    public List<Line> Lines { get; set; } = new();
}

public class Line : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public Department? Department { get; set; }

    public List<Machine> Machines { get; set; } = new();
    public OeeConfig? OeeConfig { get; set; }
}

public class Machine : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public Guid LineId { get; set; }
    public Line? Line { get; set; }
    /// <summary>Order of the machine within its line (for sequence/throughput logic).</summary>
    public int SequenceIndex { get; set; }
}
