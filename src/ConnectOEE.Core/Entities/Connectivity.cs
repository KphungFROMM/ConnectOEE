using System.ComponentModel.DataAnnotations;
using ConnectOEE.Core.Abstractions;

namespace ConnectOEE.Core.Entities;

/// <summary>A physical/logical PLC endpoint feeding one or more machines/lines.</summary>
public class PlcConnection : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public DriverType DriverType { get; set; } = DriverType.Mock;
    /// <summary>Host/IP endpoint (e.g. 192.168.1.10).</summary>
    [MaxLength(200)]
    public string? Endpoint { get; set; }
    /// <summary>libplctag path/slot (e.g. "1,0") for Rockwell.</summary>
    [MaxLength(100)]
    public string? Path { get; set; }
    public int PollIntervalMs { get; set; } = 1000;
    public bool Enabled { get; set; } = true;

    /// <summary>Optional line scoping; a connection may serve a whole line.</summary>
    public Guid? LineId { get; set; }
    public Line? Line { get; set; }

    public List<TagDefinition> Tags { get; set; } = new();
}

/// <summary>Metadata for a controller/program tag discovered or manually entered.</summary>
public class TagDefinition : EntityBase
{
    public Guid PlcConnectionId { get; set; }
    public PlcConnection? PlcConnection { get; set; }

    [MaxLength(400)]
    public string Name { get; set; } = string.Empty;
    /// <summary>Fully qualified path (program::tag.member[idx]).</summary>
    [MaxLength(1000)]
    public string FullPath { get; set; } = string.Empty;
    public TagDataType DataType { get; set; } = TagDataType.Unknown;
    [MaxLength(200)]
    public string? UdtTypeName { get; set; }
    public int ArrayLength { get; set; }
    [MaxLength(500)]
    public string? Description { get; set; }
}

/// <summary>Binds a logical signal to a concrete tag / UDT member. Audited on change.</summary>
public class TagMapping : EntityBase
{
    public Guid LogicalSignalId { get; set; }
    public LogicalSignal? LogicalSignal { get; set; }

    public Guid? TagDefinitionId { get; set; }
    public TagDefinition? TagDefinition { get; set; }

    /// <summary>Flattened UDT member path when binding to a nested member.</summary>
    [MaxLength(1000)]
    public string? MemberPath { get; set; }

    /// <summary>True when the value is entered manually (driver lacks browsing).</summary>
    public bool IsManual { get; set; }
}

/// <summary>
/// Maps a machine control command (start-permissive, reset, ack) to a writable
/// controller tag on a connection, so a controllable driver (Rockwell) can route
/// operator/supervisor commands. Kept separate from read mappings to keep write
/// surfaces explicit and auditable (see docs/08).
/// </summary>
public class MachineControlMap : EntityBase
{
    public Guid MachineId { get; set; }
    public Machine? Machine { get; set; }

    public Guid PlcConnectionId { get; set; }
    public PlcConnection? PlcConnection { get; set; }

    public PlcCommand Command { get; set; }

    [MaxLength(1000)]
    public string TagPath { get; set; } = string.Empty;

    public TagDataType DataType { get; set; } = TagDataType.Bool;
}

/// <summary>A Rockwell UDT structure definition.</summary>
public class UdtType : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public Guid? PlcConnectionId { get; set; }
    public List<UdtMember> Members { get; set; } = new();
}

/// <summary>A member of a UDT, possibly nested or an array; carries a flattened path.</summary>
public class UdtMember : EntityBase
{
    public Guid UdtTypeId { get; set; }
    public UdtType? UdtType { get; set; }

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public TagDataType DataType { get; set; } = TagDataType.Unknown;
    /// <summary>Path used for historian storage, e.g. "Motor.Status.Running".</summary>
    [MaxLength(1000)]
    public string FlattenedPath { get; set; } = string.Empty;
    public int ArrayLength { get; set; }
    /// <summary>Self-reference for nested UDT members.</summary>
    public Guid? ParentMemberId { get; set; }
}
