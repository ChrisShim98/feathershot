using System;
using System.Net.Sockets;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.Web.WebView2.Core;
using WinRT.Interop;
using Windows.Graphics;

namespace Feathershot.Services;

/// <summary>
/// A window hosting WebView2 with the static Next.js export. Created on demand and fully disposed
/// on close, so an idle Feathershot runs only the tray process.
/// </summary>
internal sealed class WebWindow : Window
{
    public const string Host = "app.feathershot.local";
    private const string DevUrl = "http://localhost:3000/";

    private readonly WebView2 _view = new();
    private readonly string _route;
    private readonly Bridge _bridge;

    public IntPtr Hwnd { get; }
    public bool IsEditor { get; }
    public event Action<WebWindow>? WindowClosed;

    public WebWindow(string route, string title, int width, int height, bool isEditor)
    {
        _route = route;
        IsEditor = isEditor;
        Title = title;
        SystemBackdrop = new MicaBackdrop();
        Content = _view;
        Hwnd = WindowNative.GetWindowHandle(this);
        _bridge = new Bridge(this);

        // Unified title bar: the page draws its own toolbar across the top and Windows keeps only its
        // caption buttons. The page reserves CaptionInset on the right and asks for drags via the bridge.
        var bar = AppWindow.TitleBar;
        bar.ExtendsContentIntoTitleBar = true;
        bar.PreferredHeightOption = TitleBarHeightOption.Tall;
        bar.ButtonBackgroundColor = Colors.Transparent;
        bar.ButtonInactiveBackgroundColor = Colors.Transparent;
        ApplyTheme(StartsDark());

        var scale = Win32.GetDpiForWindow(Hwnd) / 96.0;
        var area = DisplayArea.GetFromPoint(CursorPoint(), DisplayAreaFallback.Nearest).WorkArea;
        var w = Math.Min((int)(width * scale), area.Width - 40);
        var h = Math.Min((int)(height * scale), area.Height - 40);
        AppWindow.MoveAndResize(new RectInt32(area.X + (area.Width - w) / 2, area.Y + (area.Height - h) / 2, w, h));

        // The editor's bottom toolbar (tools, undo, save, copy) and side panel need a floor below which
        // they'd start clipping - stop the user from resizing past that instead of letting the UI break.
        if (isEditor && AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.PreferredMinimumWidth = (int)(1200 * scale);
            presenter.PreferredMinimumHeight = (int)(600 * scale);
        }
        var icon = AppPaths.Asset("feathershot.ico");
        if (System.IO.File.Exists(icon)) AppWindow.SetIcon(icon);

        Closed += OnClosed;
        _ = InitAsync();
    }

    /// <summary>Width of the caption buttons in CSS pixels, so the page can keep its toolbar clear of them.</summary>
    public double CaptionInset => AppWindow.TitleBar.RightInset / (Win32.GetDpiForWindow(Hwnd) / 96.0);

    /// <summary>Matches the caption buttons (and the pre-paint background) to the page's light or dark theme.</summary>
    public void ApplyTheme(bool dark)
    {
        var bar = AppWindow.TitleBar;
        var fg = dark ? Colors.White : ColorHelper.FromArgb(255, 0x1f, 0x1b, 0x2e);
        bar.ButtonForegroundColor = fg;
        bar.ButtonHoverForegroundColor = fg;
        bar.ButtonPressedForegroundColor = fg;
        bar.ButtonInactiveForegroundColor = dark ? ColorHelper.FromArgb(0x80, 255, 255, 255) : ColorHelper.FromArgb(0x80, 0x1f, 0x1b, 0x2e);
        bar.ButtonHoverBackgroundColor = dark ? ColorHelper.FromArgb(0x1f, 255, 255, 255) : ColorHelper.FromArgb(0x12, 0, 0, 0);
        bar.ButtonPressedBackgroundColor = dark ? ColorHelper.FromArgb(0x33, 255, 255, 255) : ColorHelper.FromArgb(0x22, 0, 0, 0);
        _view.RequestedTheme = dark ? ElementTheme.Dark : ElementTheme.Light;
        _view.DefaultBackgroundColor = dark ? ColorHelper.FromArgb(255, 0x16, 0x14, 0x1d) : ColorHelper.FromArgb(255, 0xf5, 0xf2, 0xed);
    }

    /// <summary>The saved theme, or Windows' app theme when it is "system".</summary>
    private static bool StartsDark()
    {
        var pref = App.Current.Settings.Text("theme", "system");
        if (pref != "system") return pref == "dark";
        var bg = new Windows.UI.ViewManagement.UISettings().GetColorValue(Windows.UI.ViewManagement.UIColorType.Background);
        return bg.R + bg.G + bg.B < 384;
    }

    /// <summary>Starts a native window move from the page's toolbar (the page has the mouse, so hand it over).</summary>
    public void BeginDrag()
    {
        if (!Win32.GetCursorPos(out var p)) return;
        Win32.ReleaseCapture();
        Win32.PostMessage(Hwnd, Win32.WM_NCLBUTTONDOWN, new IntPtr(Win32.HTCAPTION), new IntPtr((p.Y << 16) | (p.X & 0xffff)));
    }

    public void ToggleMaximize()
    {
        if (AppWindow.Presenter is not OverlappedPresenter p) return;
        if (p.State == OverlappedPresenterState.Maximized) p.Restore();
        else p.Maximize();
    }

    /// <summary>
    /// Activate(), plus a push past Windows' foreground-lock so a freshly opened window (most noticeably
    /// Settings, opened from a click inside the Editor's WebView2) doesn't sit behind it. Measured live:
    /// the initial push mostly lands, but something (WebView2 or WinUI's own activation bookkeeping
    /// finishing the click that triggered this) reliably steals focus back exactly one dispatch tick
    /// later — a single low-priority re-check catches that revert and wins.
    /// </summary>
    public void ActivateInFront()
    {
        Activate();
        Win32.ForceToForeground(Hwnd);
        DispatcherQueue.TryEnqueue(Microsoft.UI.Dispatching.DispatcherQueuePriority.Low, () =>
        {
            if (Win32.GetForegroundWindow() != Hwnd) Win32.ForceToForeground(Hwnd);
        });
    }

    private static PointInt32 CursorPoint() => Win32.GetCursorPos(out var p) ? new PointInt32(p.X, p.Y) : new PointInt32(0, 0);

    /// <summary>
    /// True when `next dev` is reachable on :3000. Awaited properly rather than blocked on with .Wait(),
    /// which — observed live — could time out on a merely-slow-to-connect localhost socket and silently
    /// fall back to the bundled export even while the dev server was clearly up and serving other windows.
    /// </summary>
    private static async System.Threading.Tasks.Task<bool> DevServerUpAsync()
    {
#if DEBUG
        try
        {
            using var c = new TcpClient();
            var connect = c.ConnectAsync("127.0.0.1", 3000);
            var won = await System.Threading.Tasks.Task.WhenAny(connect, System.Threading.Tasks.Task.Delay(800));
            if (won != connect)
            {
                _ = connect.ContinueWith(t => _ = t.Exception, System.Threading.Tasks.TaskContinuationOptions.OnlyOnFaulted);
                return false;
            }
            return c.Connected;
        }
        catch { return false; }
#else
        return await System.Threading.Tasks.Task.FromResult(false);
#endif
    }

    private async System.Threading.Tasks.Task InitAsync()
    {
        try
        {
#if DEBUG
            // Debug builds expose Chrome DevTools remote debugging (chrome://inspect, or http://localhost:9222) for tooling and tests.
            var options = new CoreWebView2EnvironmentOptions { AdditionalBrowserArguments = "--remote-debugging-port=9222 --remote-allow-origins=*" };
            var environment = await CoreWebView2Environment.CreateWithOptionsAsync(null, System.IO.Path.Combine(AppPaths.DataDir, "WebView2"), options);
            await _view.EnsureCoreWebView2Async(environment);
#else
            await _view.EnsureCoreWebView2Async();
#endif
            var core = _view.CoreWebView2;
            var dev = await DevServerUpAsync();

            var s = core.Settings;
            s.AreDefaultContextMenusEnabled = dev;
            s.AreDevToolsEnabled = dev;
            s.AreBrowserAcceleratorKeysEnabled = dev;
            s.IsStatusBarEnabled = false;
            s.IsZoomControlEnabled = false;
            s.IsPasswordAutosaveEnabled = false;
            s.IsGeneralAutofillEnabled = false;

            // WebView2 hosts its content in its own child window, which otherwise claims every mouse
            // event over its whole bounds — including the strip the system draws the caption (minimize/
            // maximize/close) buttons into, and the empty space in the page's own toolbar that should
            // drag the window. This tells WebView2 to defer to native non-client handling for elements
            // marked `app-region: drag`/`no-drag` in CSS, so both work despite WebView2 covering them.
            s.IsNonClientRegionSupportEnabled = true;

            // Privacy: nothing may leave the app's own virtual host (or the dev server in Debug).
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (_, e) =>
            {
                if (IsAllowed(e.Request.Uri, dev)) return;
                Log.Write($"Blocked request {e.Request.Uri}");
                e.Response = core.Environment.CreateWebResourceResponse(null, 403, "Blocked", "");
            };
            core.NavigationStarting += (_, e) =>
            {
                if (!IsAllowed(e.Uri, dev))
                {
                    Log.Write($"Blocked navigation {e.Uri}");
                    e.Cancel = true;
                }
            };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.WebMessageReceived += (_, e) => _bridge.Handle(e.WebMessageAsJson);

            // Local diagnostics only (written to the app's own log file, never sent anywhere).
            core.NavigationCompleted += (_, e) => { if (!e.IsSuccess) Log.Write($"Navigation failed: {e.WebErrorStatus}"); };
            core.ProcessFailed += (_, e) => Log.Write($"WebView process failed: {e.ProcessFailedKind}");
            await core.CallDevToolsProtocolMethodAsync("Runtime.enable", "{}");
            core.GetDevToolsProtocolEventReceiver("Runtime.exceptionThrown").DevToolsProtocolEventReceived += (_, e) => Log.Write($"JS exception: {e.ParameterObjectAsJson}");

            string url;
            if (dev)
            {
                url = DevUrl + _route;
            }
            else
            {
                core.SetVirtualHostNameToFolderMapping(Host, AppPaths.Asset("web"), CoreWebView2HostResourceAccessKind.Allow);
                // Virtual hosts do not serve a folder's index.html for a directory URL, so name the file.
                url = $"https://{Host}/{_route}index.html";
            }
            _view.Source = new Uri(url);
        }
        catch (Exception ex)
        {
            Log.Write($"WebView2 init failed: {ex}");
        }
    }
    private static bool IsAllowed(string uri, bool dev)
    {
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var u)) return false;
        if (u.Scheme is "data" or "blob" or "about") return true;
        if (string.Equals(u.Host, Host, StringComparison.OrdinalIgnoreCase)) return true;
        return dev && (u.Host is "localhost" or "127.0.0.1");
    }

    public void PostEvent(string name)
    {
        try { _view.CoreWebView2?.PostWebMessageAsJson($"{{\"event\":\"{name}\"}}"); } catch { }
    }

    public void Reply(string json)
    {
        try { _view.CoreWebView2?.PostWebMessageAsJson(json); } catch { }
    }

    private void OnClosed(object sender, WindowEventArgs args)
    {
        // Dispose the WebView2 completely, not just hide it.
        try { _view.Close(); } catch { }
        Content = null;
        WindowClosed?.Invoke(this);
    }
}
