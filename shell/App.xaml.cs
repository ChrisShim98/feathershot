using System;
using System.Reflection;
using Feathershot.Services;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.Windows.AppLifecycle;
using Windows.ApplicationModel.Activation;

namespace Feathershot;

/// <summary>
/// Feathershot is a tray app: there is no main window. Only this process, the tray icon and the
/// two watchers run while idle; toast and editor windows are created on demand.
/// </summary>
public partial class App : Application
{
    public static new App Current => (App)Application.Current;
    public static string Version { get; } = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

    internal SettingsStore Settings { get; private set; } = null!;
    internal ScreenshotIntake Intake { get; private set; } = null!;
    internal WindowManager Windows { get; private set; } = null!;
    internal ClipboardWatcher Clipboard { get; private set; } = null!;

    private FolderWatcher _folder = null!;
    private TrayService _tray = null!;
    private DispatcherQueue _ui = null!;

    public App()
    {
        InitializeComponent();
        DispatcherShutdownMode = DispatcherShutdownMode.OnExplicitShutdown;
        UnhandledException += (_, e) => { Log.Write($"Unhandled: {e.Exception}"); e.Handled = true; }; // a tray app should survive a stray exception
    }

    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
    {
        Log.Write("OnLaunched");
        _ui = DispatcherQueue.GetForCurrentThread();

        // Keep WebView2's profile in our own data folder (works packaged and unpackaged).
        Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", System.IO.Path.Combine(AppPaths.DataDir, "WebView2"));

        Settings = new SettingsStore();
        Intake = new ScreenshotIntake();
        Windows = new WindowManager();
        Intake.Detected = Windows.OnScreenshotDetected;

        Log.Write("services ready");
        Clipboard = new ClipboardWatcher(Intake);
        _folder = new FolderWatcher(Intake, _ui);
        ApplySettings();
        Settings.Changed += _ => ApplySettings();

        Log.Write("watchers ready");
        _tray = new TrayService();
        Log.Write("tray ready");

        var activation = AppInstance.GetCurrent().GetActivatedEventArgs();
        bool opened = HandleActivation(activation);

        if (!Settings.Bool("welcomeShown"))
        {
            Settings.Merge(new System.Text.Json.Nodes.JsonObject { ["welcomeShown"] = true });
            if (!opened) Windows.ShowWelcome();
            // First run: make sure the startup task is on if the user wants it (default: yes).
            _ = StartupService.ApplyAsync(Settings.Bool("startWithWindows", true));
        }
    }

    private void ApplySettings()
    {
        Clipboard.Enabled = Settings.Bool("watchClipboard", true);
        _folder.Enabled = Settings.Bool("watchFolder", true);
        _ = StartupService.ApplyAsync(Settings.Bool("startWithWindows", true));
    }

    /// <summary>Handles "Open with Feathershot" (file activation). Returns true if it opened something.</summary>
    private static bool HandleActivation(AppActivationArguments args)
    {
        if (args.Kind == ExtendedActivationKind.File && args.Data is IFileActivatedEventArgs file && file.Files.Count > 0)
        {
            _ = TrayService.OpenFileAsync(file.Files[0].Path);
            return true;
        }
        return false;
    }

    /// <summary>A second launch was redirected here by Program.Main.</summary>
    internal static void OnRedirectedActivation(AppActivationArguments args)
    {
        Current._ui.TryEnqueue(() =>
        {
            if (!HandleActivation(args)) Current.Windows.OpenEditor(null);
        });
    }

    /// <summary>
    /// H.NotifyIcon's tray messages arrive on its own hidden window, not this app's UI thread. Anything
    /// that touches XAML (opening a window, reading Settings while UI code also reads it, etc.) must be
    /// marshalled back here first, or WinUI throws (wrong-thread) and the whole process dies unhandled.
    /// </summary>
    internal void RunOnUi(Action action) => _ui.TryEnqueue(() => action());

    internal void Quit()
    {
        _tray.Dispose();
        Clipboard.Dispose();
        _folder.Dispose();
        Exit();
    }
}
