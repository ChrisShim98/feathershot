using System;
using System.IO;
using Windows.Media.Core;
using Windows.Media.Playback;

namespace Feathershot.Services;

/// <summary>Plays the toast chirp natively. Honours Mute and Windows Do Not Disturb.</summary>
internal static class Sound
{
    public static void PlayToastChirp()
    {
        try
        {
            var s = App.Current.Settings;
            if (s.Bool("muted") || Win32.IsQuietTime()) return;
            var file = AppPaths.Asset("sounds", "toast.chirp.wav");
            if (!File.Exists(file)) return;

            var player = new MediaPlayer { Volume = Math.Clamp(s.Number("volume", 0.4), 0, 1), Source = MediaSource.CreateFromUri(new Uri(file)) };
            // Never loop; release the player as soon as it finishes.
            player.MediaEnded += (p, _) => p.Dispose();
            player.MediaFailed += (p, _) => p.Dispose();
            player.Play();
        }
        catch { /* sound is optional */ }
    }
}
