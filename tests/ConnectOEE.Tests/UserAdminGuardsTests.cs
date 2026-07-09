namespace ConnectOEE.Tests;

/// <summary>Guards for user admin mutations (last-admin protection).</summary>
public static class UserAdminGuards
{
    public static bool CanRemoveAdminRole(bool targetIsAdmin, bool willRemainAdmin, int activeAdminCount)
        => !(targetIsAdmin && !willRemainAdmin && activeAdminCount <= 1);

    public static bool CanDeactivateUser(bool targetIsAdmin, int activeAdminCount)
        => !(targetIsAdmin && activeAdminCount <= 1);
}

public class UserAdminGuardsTests
{
    [Fact]
    public void Cannot_remove_admin_from_last_admin()
    {
        Assert.False(UserAdminGuards.CanRemoveAdminRole(targetIsAdmin: true, willRemainAdmin: false, activeAdminCount: 1));
    }

    [Fact]
    public void Can_remove_admin_when_other_admins_exist()
    {
        Assert.True(UserAdminGuards.CanRemoveAdminRole(targetIsAdmin: true, willRemainAdmin: false, activeAdminCount: 2));
    }

    [Fact]
    public void Cannot_deactivate_last_admin()
    {
        Assert.False(UserAdminGuards.CanDeactivateUser(targetIsAdmin: true, activeAdminCount: 1));
    }
}
