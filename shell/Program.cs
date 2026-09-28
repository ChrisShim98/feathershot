using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.Windows.AppLifecycle;

namespace Feathershot;

/// <summary>
/// Custom entry point so a second launch (Open with Feathershot, or the Start menu) is redirected
/// to the running tray instance instead of starting another one.
/// </summary>
public static class Program
{
    private const string InstanceKey = "Feathershot.Main";

    [STAThread]
    private static int Main(string[] args)
    {
        WinRT.ComWrappersSupport.InitializeComWrappers();
        Services.Log.Write("Main");

        var main = AppInstance.FindOrRegisterForKey(InstanceKey);
        if (!main.IsCurrent)
        {
            RedirectActivationTo(AppInstance.GetCurrent().GetActivatedEventArgs(), main);
            return 0;
        }

        main.Activated += (_, e) => App.OnRedirectedActivation(e);

        Application.Start(p =>
        {
            var context = new DispatcherQueueSynchronizationContext(DispatcherQueue.GetForCurrentThread());
            SynchronizationContext.SetSynchronizationContext(context);
            _ = new App();
        });
        return 0;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateEvent(IntPtr attributes, bool manualReset, bool initialState, string? name);

    [DllImport("kernel32.dll")]
    private static extern bool SetEvent(IntPtr handle);

    [DllImport("ole32.dll")]
    private static extern uint CoWaitForMultipleObjects(uint flags, uint milliseconds, ulong count, IntPtr[] handles, out uint index);

    private static void RedirectActivationTo(AppActivationArguments args, AppInstance target)
    {
        var done = CreateEvent(IntPtr.Zero, true, false, null);
        Task.Run(() =>
        {
            target.RedirectActivationToAsync(args).AsTask().Wait();
            SetEvent(done);
        });
        CoWaitForMultipleObjects(0x1 /* CWMO_DISPATCH_WINDOW_MESSAGES */, 0xFFFFFFFF, 1, [done], out _);
    }
}
