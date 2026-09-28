using System;

namespace Feathershot.Services;

/// <summary>Creates the toast, editor, settings and welcome windows on demand and lets them go on close.</summary>
internal sealed class WindowManager
{
    private WebWindow? _editor;
    private WebWindow? _settings;
    private WebWindow? _welcome;
    private ToastWindow? _toast;

    /// <summary>The screenshot that opened (or is loaded in) the editor.</summary>
    public PendingImage? Pending { get; private set; }

    /// <summary>A detected screenshot: toast by default, straight to the editor when "Open editor instantly" is on.</summary>
    public void OnScreenshotDetected(PendingImage img)
    {
        if (App.Current.Settings.Bool("openInstantly"))
        {
            OpenEditor(img);
            return;
        }
        ShowToast(img);
    }

    private void ShowToast(PendingImage img)
    {
        // One toast at a time: a new screenshot replaces the current one.
        _toast?.Dismiss(immediate: true);
        var toast = new ToastWindow(img);
        _toast = toast;
        toast.Accepted += () => OpenEditor(img);
        toast.Closed += (_, _) =>
        {
            if (_toast == toast) _toast = null;
            // A toast that was ignored or replaced releases its image.
            if (!toast.WasAccepted) img.Dispose();
        };
        toast.ShowToast();
    }

    public void OpenEditor(PendingImage? img)
    {
        if (img is not null)
        {
            var old = Pending;
            Pending = img;
            if (old is not null && !ReferenceEquals(old, img)) old.Dispose();
        }

        if (_editor is not null)
        {
            _editor.PostEvent("imageAvailable");
            _editor.ActivateInFront();
            return;
        }

        var w = new WebWindow("", "Feathershot", 1240, 800, isEditor: true);
        _editor = w;
        w.WindowClosed += _ =>
        {
            _editor = null;
            Pending?.Dispose();
            Pending = null;
            Release();
        };
        w.ActivateInFront();
        _toast?.Dismiss(immediate: true);
    }

    public void OpenSettings(bool about = false)
    {
        if (_settings is not null) { _settings.ActivateInFront(); return; }
        _settings = new WebWindow(about ? "settings/#about" : "settings/", "Feathershot settings", 620, 760, isEditor: false);
        _settings.WindowClosed += _ => { _settings = null; Release(); };
        _settings.ActivateInFront();
    }

    public void ShowWelcome()
    {
        if (_welcome is not null) { _welcome.ActivateInFront(); return; }
        _welcome = new WebWindow("welcome/", "Welcome to Feathershot", 520, 460, isEditor: false);
        _welcome.WindowClosed += _ => { _welcome = null; Release(); };
        _welcome.ActivateInFront();
    }

    /// <summary>After a window closes, hand memory back so the idle tray process stays small.</summary>
    private static void Release()
    {
        GC.Collect();
        GC.WaitForPendingFinalizers();
        Win32.TrimWorkingSet();
    }
}
