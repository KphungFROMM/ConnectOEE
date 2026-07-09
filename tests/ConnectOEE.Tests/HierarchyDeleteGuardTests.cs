namespace ConnectOEE.Tests;

public class HierarchyDeleteGuardTests
{
    [Fact]
    public void Blockers_is_blocked_when_lines_exist()
    {
        var blockers = new ConnectOEE.Api.Services.HierarchyDeleteBlockers(Lines: 2);
        Assert.True(blockers.IsBlocked);
        Assert.Contains("2 line(s)", blockers.Messages());
    }

    [Fact]
    public void Blockers_not_blocked_when_empty()
    {
        var blockers = new ConnectOEE.Api.Services.HierarchyDeleteBlockers();
        Assert.False(blockers.IsBlocked);
        Assert.Empty(blockers.Messages());
    }
}
