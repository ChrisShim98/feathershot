using System;
using System.IO;
using System.Text.Json.Nodes;
using Windows.Storage;

namespace Feathershot.Services;

internal static class AppPaths
{
    /// <summary>The app's LocalFolder when packaged, %LOCALAPPDATA%\Feathershot otherwise.</summary>
    public static readonly string DataDir = ResolveDataDir();

    private static string ResolveDataDir()
    {
        string dir;
        try { dir = Win32.IsPackaged ? ApplicationData.Current.LocalFolder.Path : Fallback(); }
        catch { dir = Fallback(); }
        Directory.CreateDirectory(dir);
        return dir;
    }

    private static string Fallback() => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Feathershot");

    public static string Asset(params string[] parts) => Path.Combine([AppContext.BaseDirectory, "Assets", .. parts]);

    public static string PicturesDir => Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
}

/// <summary>Settings and presets as JSON in the app's LocalFolder. Opaque to C#: the web app owns the schema.</summary>
internal sealed class SettingsStore
{
    private static readonly string[] Known =
    [
        "watchClipboard", "watchFolder", "openInstantly", "autoClose", "muted", "volume",
        "startWithWindows", "welcomeShown", "lastStyle", "presets", "theme",
    ];

    private readonly string _file = Path.Combine(AppPaths.DataDir, "settings.json");
    private JsonObject _root;

    public event Action<string[]>? Changed;

    public SettingsStore()
    {
        _root = Defaults();
        try
        {
            if (File.Exists(_file) && JsonNode.Parse(File.ReadAllText(_file)) is JsonObject saved)
                foreach (var kv in saved) if (Array.IndexOf(Known, kv.Key) >= 0) _root[kv.Key] = kv.Value?.DeepClone();
        }
        catch { /* corrupt file: start from defaults */ }
    }

    private static JsonObject Defaults() => new()
    {
        ["watchClipboard"] = true,
        ["watchFolder"] = true,
        ["openInstantly"] = true,
        ["autoClose"] = false,
        ["muted"] = false,
        ["volume"] = 0.4,
        ["startWithWindows"] = true,
        ["welcomeShown"] = false,
        ["lastStyle"] = null,
        ["presets"] = new JsonArray(),
        ["theme"] = "system",
    };

    public bool Bool(string key, bool fallback = false) => _root[key] is JsonValue v && v.TryGetValue<bool>(out var b) ? b : fallback;
    public string Text(string key, string fallback) => _root[key] is JsonValue v && v.TryGetValue<string>(out var t) ? t : fallback;
    public double Number(string key, double fallback) => _root[key] is JsonValue v && v.TryGetValue<double>(out var d) ? d : fallback;

    public JsonObject Snapshot() => (JsonObject)_root.DeepClone();

    /// <summary>Shallow-merges known keys and saves.</summary>
    public JsonObject Merge(JsonObject patch)
    {
        var changed = new System.Collections.Generic.List<string>();
        foreach (var kv in patch)
        {
            if (Array.IndexOf(Known, kv.Key) < 0) continue;
            _root[kv.Key] = kv.Value?.DeepClone();
            changed.Add(kv.Key);
        }
        if (changed.Count > 0)
        {
            Save();
            Changed?.Invoke([.. changed]);
        }
        return Snapshot();
    }

    private void Save()
    {
        try
        {
            var tmp = _file + ".tmp";
            File.WriteAllText(tmp, _root.ToJsonString());
            File.Move(tmp, _file, true);
        }
        catch { /* settings are a convenience; never crash over them */ }
    }
}
