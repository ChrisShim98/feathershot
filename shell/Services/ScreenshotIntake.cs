using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Feathershot.Services;

internal enum ImageSource { Clipboard, Folder, Manual }

/// <summary>
/// Single funnel for detected screenshots: applies pause, size, and duplicate rules, then hands the
/// image to the window manager. Everything here runs on the UI thread.
/// </summary>
internal sealed class ScreenshotIntake
{
    private const int MinSide = 50;
    private static readonly TimeSpan DuplicateWindow = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan SameShotWindow = TimeSpan.FromMilliseconds(1500);

    private readonly List<(string Hash, DateTime At)> _recent = [];
    private readonly HashSet<string> _own = [];
    private DateTime _lastAccepted = DateTime.MinValue;
    private int _lastW, _lastH;
    private DateTime _pausedUntil = DateTime.MinValue;

    public Action<PendingImage>? Detected { get; set; }
    public event Action? PauseChanged;

    public bool Paused => _pausedUntil > DateTime.UtcNow;
    public bool PausedIndefinitely => _pausedUntil == DateTime.MaxValue;

    public void PauseFor(TimeSpan span) { _pausedUntil = DateTime.UtcNow + span; PauseChanged?.Invoke(); }
    public void PauseUntilResumed() { _pausedUntil = DateTime.MaxValue; PauseChanged?.Invoke(); }
    public void Resume() { _pausedUntil = DateTime.MinValue; PauseChanged?.Invoke(); }

    /// <summary>Remember an image Feathershot itself put on the clipboard so it never prompts about it.</summary>
    public void RecordOwnCopy(string hash)
    {
        _own.Add(hash);
        if (_own.Count > 16) _own.Clear();
    }

    /// <summary>Returns true if the image was accepted and passed on.</summary>
    public bool Offer(PendingImage img, ImageSource source)
    {
        var now = DateTime.UtcNow;
        _recent.RemoveAll(r => now - r.At > DuplicateWindow);

        bool reject =
            (source != ImageSource.Manual && Paused) ||
            img.Width < MinSide || img.Height < MinSide ||
            _own.Contains(img.Hash) ||
            _recent.Exists(r => r.Hash == img.Hash) ||
            // Win+PrintScreen fires both the clipboard and the folder for one shot, and the two hashes can differ slightly.
            (source != ImageSource.Manual && now - _lastAccepted < SameShotWindow && img.Width == _lastW && img.Height == _lastH);

        if (reject)
        {
            Log.Write($"Rejected {source} {img.Width}x{img.Height} (paused={Paused})");
            img.Dispose();
            return false;
        }

        _recent.Add((img.Hash, now));
        _lastAccepted = now;
        _lastW = img.Width;
        _lastH = img.Height;
        Log.Write($"Accepted {source} {img.Width}x{img.Height}");
        Detected?.Invoke(img);
        return true;
    }
}
