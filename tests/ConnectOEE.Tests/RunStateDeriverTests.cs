using ConnectOEE.Api.Live;
using ConnectOEE.Core;

namespace ConnectOEE.Tests;

public class RunStateDeriverTests
{
    [Fact]
    public void DirectEnum_maps_integer_to_run_state()
    {
        Assert.Equal(RunState.Running, RunStateDeriver.Derive(RunStateIngestMode.DirectEnum, 1, null, null, null));
        Assert.Equal(RunState.Idle, RunStateDeriver.Derive(RunStateIngestMode.DirectEnum, 2, null, null, null));
        Assert.Equal(RunState.Unknown, RunStateDeriver.Derive(RunStateIngestMode.DirectEnum, 99, null, null, null));
    }

    [Fact]
    public void SingleBool_true_is_running_false_is_idle()
    {
        Assert.Equal(RunState.Running, RunStateDeriver.Derive(RunStateIngestMode.SingleBool, 1, null, null, null));
        Assert.Equal(RunState.Idle, RunStateDeriver.Derive(RunStateIngestMode.SingleBool, 0, null, null, null));
    }

    [Fact]
    public void MultiBool_priority_faulted_over_running_over_idle()
    {
        Assert.Equal(RunState.Down, RunStateDeriver.Derive(RunStateIngestMode.MultiBool, null, true, false, true));
        Assert.Equal(RunState.Running, RunStateDeriver.Derive(RunStateIngestMode.MultiBool, null, true, true, false));
        Assert.Equal(RunState.Idle, RunStateDeriver.Derive(RunStateIngestMode.MultiBool, null, false, true, false));
    }

    [Fact]
    public void MultiBool_falls_back_to_primary_as_single_bool()
    {
        Assert.Equal(RunState.Running, RunStateDeriver.Derive(RunStateIngestMode.MultiBool, 1, null, null, null));
        Assert.Equal(RunState.Idle, RunStateDeriver.Derive(RunStateIngestMode.MultiBool, 0, null, null, null));
    }
}
