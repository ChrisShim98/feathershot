using System;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Windows.ApplicationModel.DataTransfer;
using Windows.Storage.Streams;

namespace Feathershot.Services;

/// <summary>
/// Native side of web/lib/shell.ts. Each request is {id, method, args}; each reply is {id, result} or {id, error}.
/// </summary>
internal sealed class Bridge
{
    private readonly WebWindow _owner;

    public Bridge(WebWindow owner) => _owner = owner;

    public async void Handle(string json)
    {
        int id = -1;
        try
        {
            var msg = JsonNode.Parse(json)!;
            id = msg["id"]!.GetValue<int>();
            var method = msg["method"]!.GetValue<string>();
            var args = msg["args"] as JsonObject ?? [];
            var result = await DispatchAsync(method, args);
            Log.Write($"bridge {method} ok");
            _owner.Reply(new JsonObject { ["id"] = id, ["result"] = result }.ToJsonString());
        }
        catch (Exception ex)
        {
            Log.Write($"bridge error: {ex.Message}");
            if (id >= 0) _owner.Reply(new JsonObject { ["id"] = id, ["error"] = ex.Message }.ToJsonString());
        }
    }

    private async Task<JsonNode?> DispatchAsync(string method, JsonObject args)
    {
        var app = App.Current;
        switch (method)
        {
            case "getPendingImage":
            {
                var img = app.Windows.Pending;
                if (img is null) return null;
                return Convert.ToBase64String(await img.GetBytesAsync());
            }

            case "copyImage":
                await CopyImageAsync(Convert.FromBase64String(args["png"]!.GetValue<string>()));
                return true;

            case "saveImage":
                return Save(Convert.FromBase64String(args["data"]!.GetValue<string>()), args["format"]!.GetValue<string>());

            case "startDragOut":
                // Native drag-out is planned for v1.1; the editor falls back to an HTML5 drag.
                return false;

            case "getSettings":
                return app.Settings.Snapshot();

            case "setSettings":
                return app.Settings.Merge(args["patch"] as JsonObject ?? []);

            case "getEnv":
                var startupState = await StartupService.GetStateAsync();
                var blocked = startupState is Windows.ApplicationModel.StartupTaskState.DisabledByUser
                    or Windows.ApplicationModel.StartupTaskState.DisabledByPolicy
                    ? startupState.ToString()
                    : null;
                return new JsonObject
                {
                    ["quiet"] = Win32.IsQuietTime(),
                    ["version"] = App.Version,
                    ["native"] = true,
                    ["startupBlockedReason"] = blocked,
                    ["captionInset"] = _owner.CaptionInset,
                };

            case "beginWindowDrag":
                _owner.BeginDrag();
                return true;

            case "toggleMaximize":
                _owner.ToggleMaximize();
                return true;

            case "setWindowTheme":
                _owner.ApplyTheme(args["dark"]?.GetValue<bool>() ?? false);
                return true;

            case "closeEditor":
                // Defer so the reply can be delivered before the WebView goes away.
                _owner.DispatcherQueue.TryEnqueue(() => _owner.Close());
                return true;

            case "openSettings":
            {
                // Deferred, not called inline: this runs on the same message dispatch as the click that
                // triggered it, and forcing a new window to the foreground while that click is still being
                // processed lost the race against the Editor's own focus handling reasserting itself right
                // after — the new window would win the z-order fight for a moment and then fall back behind
                // it. Letting that dispatch finish first before we touch focus fixed it.
                var about = args["about"]?.GetValue<bool>() ?? false;
                _owner.DispatcherQueue.TryEnqueue(() => app.Windows.OpenSettings(about));
                return true;
            }

            case "openWelcome":
                _owner.DispatcherQueue.TryEnqueue(() => app.Windows.ShowWelcome());
                return true;

            case "openExternal":
            {
                // Only ms-settings: deep links (e.g. the Windows notification settings page), never a
                // web URL: this bridge must not become a way around the app's no-network policy.
                var uri = args["uri"]!.GetValue<string>();
                if (!uri.StartsWith("ms-settings:", StringComparison.OrdinalIgnoreCase)) return false;
                return await Windows.System.Launcher.LaunchUriAsync(new Uri(uri));
            }

            default:
                throw new InvalidOperationException($"Unknown method: {method}");
        }
    }

    private static async Task CopyImageAsync(byte[] png)
    {
        var app = App.Current;

        // Record the hash first so the clipboard listener never prompts about our own image.
        using (var bmp = await ImageUtil.DecodeAsync(png))
            app.Intake.RecordOwnCopy(ImageUtil.Hash(bmp));

        var stream = new InMemoryRandomAccessStream();
        await stream.WriteAsync(png.AsBuffer());
        stream.Seek(0);

        var package = new DataPackage { RequestedOperation = DataPackageOperation.Copy };
        package.SetBitmap(RandomAccessStreamReference.CreateFromStream(stream));
        Clipboard.SetContent(package);
        try { Clipboard.Flush(); } catch { /* not fatal: content is still delegated */ }
        app.Clipboard.MarkOwnChange();
    }

    private JsonObject Save(byte[] data, string format)
    {
        bool jpg = format == "jpg";
        var dir = Path.Combine(AppPaths.PicturesDir, "Feathershot");
        Directory.CreateDirectory(dir);
        var name = $"Feathershot {DateTime.Now:yyyy-MM-dd HH.mm.ss}";
        var path = Win32.FileDialog(
            save: true, _owner.Hwnd, "Save image",
            "PNG image\0*.png\0JPEG image\0*.jpg\0", jpg ? 2 : 1, dir, name, jpg ? "jpg" : "png");
        if (path is null) return new JsonObject { ["saved"] = false };
        File.WriteAllBytes(path, data);
        return new JsonObject { ["saved"] = true, ["path"] = path };
    }
}
