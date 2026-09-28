using System;
using System.IO;
using H.NotifyIcon.Core;

namespace Feathershot.Services;

/// <summary>
/// The tray icon: double-click opens the window, right-click shows Open window / version / Pause /
/// Exit — the same shape as the Claude desktop app's tray menu, plus the one item (Pause) that has
/// to work without opening a window, for screen-sharing or gaming. Exit is the only way to quit;
/// closing every window just returns Feathershot to the tray.
/// </summary>
internal sealed class TrayService : IDisposable
{
    private readonly TrayIconWithContextMenu _icon;
    private readonly PopupMenuItem _pauseHour;
    private readonly PopupMenuItem _pauseUntil;
    private readonly PopupMenuItem _resume;

    public TrayService()
    {
        _pauseHour = new PopupMenuItem("For 1 hour", (_, _) => App.Current.RunOnUi(() => App.Current.Intake.PauseFor(TimeSpan.FromHours(1))));
        _pauseUntil = new PopupMenuItem("Until I resume", (_, _) => App.Current.RunOnUi(() => App.Current.Intake.PauseUntilResumed()));
        _resume = new PopupMenuItem("Resume", (_, _) => App.Current.RunOnUi(() => App.Current.Intake.Resume()));

        var pauseItem = new PopupSubMenu("Pause") { Items = { _pauseHour, _pauseUntil, new PopupMenuSeparator(), _resume } };

        var menu = new PopupMenu
        {
            Items =
            {
                new PopupMenuItem("Open window", (_, _) => App.Current.RunOnUi(() => App.Current.Windows.OpenEditor(null))),
                new PopupMenuItem($"Version {App.Version}", (_, _) => { }) { Enabled = false },
                new PopupMenuSeparator(),
                pauseItem,
                new PopupMenuSeparator(),
                new PopupMenuItem("Exit", (_, _) => App.Current.RunOnUi(() => App.Current.Quit())),
            },
        };

        _icon = new TrayIconWithContextMenu("Feathershot") { ContextMenu = menu, ToolTip = "Feathershot" };
        var ico = AppPaths.Asset("feathershot.ico");
        if (File.Exists(ico))
        {
            int size = Win32.GetSystemMetrics(49); // SM_CXSMICON
            _icon.Icon = Win32.LoadImage(IntPtr.Zero, ico, 1 /* IMAGE_ICON */, size, size, 0x10 /* LR_LOADFROMFILE */);
        }

        // Tray messages arrive on H.NotifyIcon's own hidden window, so hop back to the UI thread
        // before touching any XAML — doing it inline previously crashed the whole process.
        _icon.MessageWindow.MouseEventReceived += (_, e) =>
        {
            if (e.MouseEvent is MouseEvent.IconDoubleClick or MouseEvent.IconLeftDoubleClick)
                App.Current.RunOnUi(() => App.Current.Windows.OpenEditor(null));
        };
        _icon.Create();

        App.Current.Intake.PauseChanged += Refresh;
        Refresh();
    }

    private void Refresh()
    {
        var intake = App.Current.Intake;
        _pauseHour.Enabled = !intake.Paused;
        _pauseUntil.Enabled = !intake.Paused;
        _resume.Enabled = intake.Paused;
        _icon.UpdateToolTip(intake.Paused ? "Feathershot (paused)" : "Feathershot");
    }

    /// <summary>Opening an image dropped on the tray icon or via "Open with Feathershot".</summary>
    public static async System.Threading.Tasks.Task OpenFileAsync(string path)
    {
        try
        {
            var img = await ImageUtil.FromFileBytesAsync(await File.ReadAllBytesAsync(path));
            App.Current.Windows.OpenEditor(img);
        }
        catch { /* not an image we can read */ }
    }

    public void Dispose() => _icon.Dispose();
}
