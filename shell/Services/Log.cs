using System;
using System.IO;

namespace Feathershot.Services;

/// <summary>Tiny local log (never sent anywhere) to help diagnose problems on a user's own PC.</summary>
internal static class Log
{
    private static readonly string File_ = Path.Combine(AppPaths.DataDir, "feathershot.log");

    public static void Write(string message)
    {
        try
        {
            if (File.Exists(File_) && new FileInfo(File_).Length > 256 * 1024) File.Delete(File_);
            File.AppendAllText(File_, $"{DateTime.Now:HH:mm:ss.fff} {message}{Environment.NewLine}");
        }
        catch { }
    }
}
