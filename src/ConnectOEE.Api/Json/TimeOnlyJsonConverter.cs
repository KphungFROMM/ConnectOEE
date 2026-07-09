using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ConnectOEE.Api.Json;

/// <summary>
/// Parses HTML time inputs (HH:mm) and API round-trip values (HH:mm:ss) for shift DTOs.
/// </summary>
public sealed class TimeOnlyJsonConverter : JsonConverter<TimeOnly>
{
    private static readonly string[] Formats = ["HH:mm:ss", "HH:mm", "H:mm:ss", "H:mm"];

    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var s = reader.GetString();
        if (string.IsNullOrWhiteSpace(s))
            throw new JsonException("Time value is required.");

        if (TimeOnly.TryParseExact(s, Formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var exact))
            return exact;

        if (TimeOnly.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            return parsed;

        throw new JsonException($"Invalid time value: {s}");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.ToString("HH:mm:ss", CultureInfo.InvariantCulture));
}

public sealed class NullableTimeOnlyJsonConverter : JsonConverter<TimeOnly?>
{
    private readonly TimeOnlyJsonConverter _inner = new();

    public override TimeOnly? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.TokenType == JsonTokenType.Null ? null : _inner.Read(ref reader, typeof(TimeOnly), options);

    public override void Write(Utf8JsonWriter writer, TimeOnly? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else _inner.Write(writer, value.Value, options);
    }
}
