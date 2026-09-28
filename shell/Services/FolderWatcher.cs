using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;

namespace Feathershot.Services;

/// <summary>
/// Watches the Screenshots folder (Win+PrintScreen, Snipping Tool auto-save). The real path is
/// resolved through the shell so a OneDrive-redirected Pictures folder is followed.
/// </summary>
internal sealed class FolderWatcher : IDisposable
{
    private readonly ScreenshotIntake _intake;
    private readonly DispatcherQueue _ui;
    private readonly Dictionary<string, DateTime> _seen = [];
    private FileSystemWatcher? _watcher;
    private FileSystemWatcher? _parentWatcher;
    private bool _enabled;

    public FolderWatcher(ScreenshotIntake intake, DispatcherQueue ui)
    {
        _intake = intake;
        _ui = ui;
    }

    public static string ResolveFolder() =>
        Win32.KnownFolder(Win32.FolderScreenshots) ?? Path.Combine(AppPaths.PicturesDir, "Screenshots");

    public bool Enabled
    {
        get => _enabled;
        set
        {
            if (value == _enabled) return;
            _enabled = value;
            if (value) Start(); else Stop();
        }
    }

    private void Start()
    {
        var folder = ResolveFolder();
        try
        {
            if (Directory.Exists(folder))
            {
                _watcher = Create(folder);
                return;
            }
            // The folder appears after the first Win+PrintScreen; wait for it.
            var parent = Path.GetDirectoryName(folder);
            if (parent is null || !Directory.Exists(parent)) return;
            _parentWatcher = new FileSystemWatcher(parent) { NotifyFilter = NotifyFilters.DirectoryName, EnableRaisingEvents = true };
            _parentWatcher.Created += (_, e) =>
            {
                if (!string.Equals(e.FullPath, folder, StringComparison.OrdinalIgnoreCase)) return;
                _ui.TryEnqueue(() => { if (_enabled && _watcher is null) _watcher = Create(folder); });
            };
        }
        catch { /* folder unavailable: nothing to watch */ }
    }

    private FileSystemWatcher Create(string folder)
    {
        var w = new FileSystemWatcher(folder)
        {
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite,
            InternalBufferSize = 16 * 1024,
        };
        w.Created += (_, e) => _ = OnFileAsync(e.FullPath);
        w.Renamed += (_, e) => _ = OnFileAsync(e.FullPath);
        w.EnableRaisingEvents = true;
        return w;
    }

    private void Stop()
    {
        _watcher?.Dispose();
        _parentWatcher?.Dispose();
        _watcher = _parentWatcher = null;
    }

    private async Task OnFileAsync(string path)
    {
        try
        {
            var ext = Path.GetExtension(path).ToLowerInvariant();
            if (ext is not (".png" or ".jpg" or ".jpeg")) return;

            lock (_seen)
            {
                var now = DateTime.UtcNow;
                if (_seen.TryGetValue(path, out var t) && now - t < TimeSpan.FromSeconds(3)) return;
                _seen[path] = now;
                if (_seen.Count > 64) _seen.Clear();
            }

            // Wait until the writer has finished with the file.
            byte[]? bytes = null;
            for (int i = 0; i < 40 && bytes is null; i++)
            {
                try
                {
                    using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
                    if (fs.Length > 0)
                    {
                        bytes = new byte[fs.Length];
                        await fs.ReadExactlyAsync(bytes);
                    }
                }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
                if (bytes is null) await Task.Delay(100);
            }
            if (bytes is null) return;

            _ui.TryEnqueue(async () =>
            {
                try
                {
                    var img = await ImageUtil.FromFileBytesAsync(bytes);
                    _intake.Offer(img, ImageSource.Folder);
                }
                catch { /* not a decodable image */ }
            });
        }
        catch { /* ignore */ }
    }

    public void Dispose() => Stop();
}
