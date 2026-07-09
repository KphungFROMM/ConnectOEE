using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ConnectOEE.Core.Entities;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ConnectOEE.Tests;

public class ShiftPatternSaveTests
{
    private const string Conn =
        "Host=localhost;Port=5433;Database=connectoee;Username=connectoee;Password=connectoee_dev_pw";

    [Fact]
    public async Task Ef_can_persist_wizard_like_shift_pattern()
    {
        await using var db = new ConnectOeeDbContext(
            new DbContextOptionsBuilder<ConnectOeeDbContext>().UseNpgsql(Conn).Options);

        var pattern = new ShiftPattern { Name = "__test__ 3x8 Fixed" };
        pattern.Definitions.Add(new ShiftDefinition
        {
            ShiftPattern = pattern,
            Name = "Morning",
            StartTime = new TimeOnly(6, 0),
            EndTime = new TimeOnly(14, 0),
            Color = "#2E9E5B",
            OrderIndex = 0,
        });
        pattern.Definitions.Add(new ShiftDefinition
        {
            ShiftPattern = pattern,
            Name = "Day",
            StartTime = new TimeOnly(14, 0),
            EndTime = new TimeOnly(22, 0),
            Color = "#E0A800",
            OrderIndex = 1,
        });
        pattern.Definitions.Add(new ShiftDefinition
        {
            ShiftPattern = pattern,
            Name = "Night",
            StartTime = new TimeOnly(22, 0),
            EndTime = new TimeOnly(6, 0),
            CrossesMidnight = true,
            Color = "#4C8DFF",
            OrderIndex = 2,
        });

        db.ShiftPatterns.Add(pattern);
        await db.SaveChangesAsync();

        var loaded = await db.ShiftPatterns.Include(p => p.Definitions)
            .FirstAsync(p => p.Name == "__test__ 3x8 Fixed");
        Assert.Equal(3, loaded.Definitions.Count);

        db.ShiftPatterns.Remove(loaded);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Api_binds_and_saves_wizard_json_payload()
    {
        const string signingKey = "REPLACE_IN_LOCAL_OR_PROD_dev-only-signing-key-change-me-please-32+chars";
        await using var db = new ConnectOeeDbContext(
            new DbContextOptionsBuilder<ConnectOeeDbContext>().UseNpgsql(Conn).Options);
        var adminId = await db.Users.Where(u => u.UserName == "admin").Select(u => u.Id).FirstAsync();

        using var client = new HttpClient { BaseAddress = new Uri("http://localhost:5080") };

        var anon = await client.PostAsJsonAsync("/api/shifts/patterns", WizardPayload());
        Assert.True(anon.StatusCode is System.Net.HttpStatusCode.Unauthorized
            or System.Net.HttpStatusCode.Forbidden);

        var token = CreateDevToken(adminId, signingKey);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var create = await client.PostAsJsonAsync("/api/shifts/patterns", WizardPayload());
        var body = await create.Content.ReadAsStringAsync();
        Assert.True(create.IsSuccessStatusCode, $"Expected 200, got {(int)create.StatusCode}: {body}");

        var created = JsonDocument.Parse(body);
        var id = created.RootElement.GetProperty("id").GetGuid();

        var cleanup = await client.DeleteAsync($"/api/shifts/patterns/{id}");
        Assert.True(cleanup.IsSuccessStatusCode, await cleanup.Content.ReadAsStringAsync());
    }

    private static string CreateDevToken(Guid userId, string signingKey)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, "Admin"),
            new("perm", "shifts.manage"),
            new("perm", "hierarchy.manage"),
        };
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken("ConnectOEE", "ConnectOEE", claims,
            expires: DateTime.UtcNow.AddHours(1), signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    private static object WizardPayload() => new
    {
        name = "3x8 Fixed",
        definitions = new object[]
        {
            new { name = "Morning", startTime = "06:00", endTime = "14:00", color = "#2E9E5B", orderIndex = 0, breaks = Array.Empty<object>() },
            new { name = "Day", startTime = "14:00", endTime = "22:00", color = "#E0A800", orderIndex = 1, breaks = Array.Empty<object>() },
            new { name = "Night", startTime = "22:00", endTime = "06:00", crossesMidnight = true, color = "#4C8DFF", orderIndex = 2, breaks = Array.Empty<object>() },
        },
    };
}
