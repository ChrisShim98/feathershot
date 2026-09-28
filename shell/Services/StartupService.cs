using System;
using System.Threading.Tasks;
using Windows.ApplicationModel;

namespace Feathershot.Services;

/// <summary>Start with Windows, through the MSIX startup task declared in Package.appxmanifest.</summary>
internal static class StartupService
{
    public const string TaskId = "FeathershotStartupTask";

    public static async Task ApplyAsync(bool enabled)
    {
        if (!Win32.IsPackaged) return;
        try
        {
            var task = await StartupTask.GetAsync(TaskId);
            if (enabled)
            {
                // Disabled means "never asked, or the user hasn't said no": ask once. DisabledByUser and
                // DisabledByPolicy mean Windows itself (or the user, in Settings > Apps > Startup) turned it
                // off; we must not re-prompt for those, or it looks like the app is fighting the user's choice.
                if (task.State == StartupTaskState.Disabled)
                {
                    var result = await task.RequestEnableAsync();
                    Log.Write($"Startup task requested -> {result}");
                }
            }
            else if (task.State is StartupTaskState.Enabled or StartupTaskState.EnabledByPolicy)
            {
                task.Disable();
                Log.Write("Startup task disabled");
            }
        }
        catch (Exception ex) { Log.Write($"Startup task apply failed: {ex.Message}"); }
    }

    /// <summary>Current state, for Settings to show the user why the toggle might not match what they picked.</summary>
    public static async Task<StartupTaskState?> GetStateAsync()
    {
        if (!Win32.IsPackaged) return null;
        try { return (await StartupTask.GetAsync(TaskId)).State; }
        catch { return null; }
    }
}
