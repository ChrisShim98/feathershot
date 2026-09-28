using System;
using System.Runtime.InteropServices;
using System.Text;

namespace Feathershot.Services;

/// <summary>The handful of Win32 calls the shell needs.</summary>
internal static class Win32
{
    public const int WM_CLIPBOARDUPDATE = 0x031D;
    public const uint WM_NCLBUTTONDOWN = 0x00A1;
    public const int HTCAPTION = 2;
    public const int GWL_EXSTYLE = -20;
    public const long WS_EX_TOOLWINDOW = 0x80, WS_EX_NOACTIVATE = 0x08000000;
    public static readonly IntPtr HWND_MESSAGE = new(-3);

    public delegate IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct WNDCLASSEX
    {
        public uint cbSize, style;
        public IntPtr lpfnWndProc;
        public int cbClsExtra, cbWndExtra;
        public IntPtr hInstance, hIcon, hCursor, hbrBackground, lpszMenuName, lpszClassName, hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct OPENFILENAME
    {
        public uint lStructSize;
        public IntPtr hwndOwner, hInstance, lpstrFilter, lpstrCustomFilter;
        public uint nMaxCustFilter, nFilterIndex;
        public IntPtr lpstrFile;
        public uint nMaxFile;
        public IntPtr lpstrFileTitle;
        public uint nMaxFileTitle;
        public IntPtr lpstrInitialDir, lpstrTitle;
        public uint Flags;
        public ushort nFileOffset, nFileExtension;
        public IntPtr lpstrDefExt, lCustData, lpfnHook, lpTemplateName, pvReserved;
        public uint dwReserved, FlagsEx;
    }

    [DllImport("user32.dll", SetLastError = true)] public static extern bool AddClipboardFormatListener(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool RemoveClipboardFormatListener(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool IsClipboardFormatAvailable(uint format);
    [DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern uint RegisterClipboardFormat(string name);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern ushort RegisterClassEx(ref WNDCLASSEX wc);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateWindowEx(uint exStyle, IntPtr className, IntPtr windowName, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr inst, IntPtr param);
    [DllImport("user32.dll")] public static extern bool DestroyWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern IntPtr DefWindowProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] public static extern bool ReleaseCapture();
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int w, int h, uint flags);
    public static readonly IntPtr HWND_TOPMOST = new(-1);
    public static readonly IntPtr HWND_NOTOPMOST = new(-2);
    public const uint SWP_NOMOVE = 0x0002, SWP_NOSIZE = 0x0001, SWP_NOACTIVATE = 0x0010, SWP_SHOWWINDOW = 0x0040;

    /// <summary>
    /// Forces a window to the front even under Windows' foreground-lock timeout, which can otherwise
    /// silently leave a freshly created window sitting behind whatever already had focus (seen on a
    /// window's first open, opened from a click inside another one of the app's own WebView2 windows).
    /// A plain SetForegroundWindow call is subject to that lock; toggling z-order to topmost and back is
    /// a z-order change, not a focus change, so it isn't.
    /// </summary>
    public static void ForceToForeground(IntPtr hwnd)
    {
        SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        SetForegroundWindow(hwnd);
    }
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hwnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr LoadImage(IntPtr inst, string name, uint type, int cx, int cy, uint flags);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr GetModuleHandle(string? name);
    [DllImport("kernel32.dll")] public static extern bool SetProcessWorkingSetSize(IntPtr process, IntPtr min, IntPtr max);
    [DllImport("kernel32.dll")] public static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern int GetCurrentPackageFullName(ref int length, StringBuilder? name);
    [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] private static extern int SHGetKnownFolderPath(ref Guid id, uint flags, IntPtr token, out IntPtr path);
    [DllImport("comdlg32.dll", CharSet = CharSet.Unicode)] private static extern bool GetSaveFileName(ref OPENFILENAME ofn);
    [DllImport("comdlg32.dll", CharSet = CharSet.Unicode)] private static extern bool GetOpenFileName(ref OPENFILENAME ofn);

    private static bool? _packaged;
    public static bool IsPackaged
    {
        get
        {
            if (_packaged is null)
            {
                int len = 0;
                _packaged = GetCurrentPackageFullName(ref len, null) != 15700; // APPMODEL_ERROR_NO_PACKAGE
            }
            return _packaged.Value;
        }
    }

    /// <summary>True when Windows reports Do Not Disturb / quiet time (or presentation mode).</summary>
    public static bool IsQuietTime()
    {
        try
        {
            // 2 = busy, 3 = D3D fullscreen, 4 = presentation mode, 6 = quiet time (Do Not Disturb)
            return SHQueryUserNotificationState(out int s) == 0 && s is 2 or 3 or 4 or 6;
        }
        catch { return false; }
    }

    public static readonly Guid FolderScreenshots = new("B7BEDE81-DF94-4682-A7D8-57A52620B86F");

    /// <summary>Resolves a known folder, following OneDrive redirection.</summary>
    public static string? KnownFolder(Guid id)
    {
        try
        {
            if (SHGetKnownFolderPath(ref id, 0, IntPtr.Zero, out var p) != 0) return null;
            var s = Marshal.PtrToStringUni(p);
            Marshal.FreeCoTaskMem(p);
            return s;
        }
        catch { return null; }
    }

    public static void TrimWorkingSet() => SetProcessWorkingSetSize(GetCurrentProcess(), new IntPtr(-1), new IntPtr(-1));

    /// <summary>Classic file dialog, used because it can open in an exact folder.</summary>
    public static string? FileDialog(bool save, IntPtr owner, string title, string filter, int filterIndex, string? initialDir, string? defaultName, string? defExt)
    {
        const int MAX = 1024;
        var file = Marshal.AllocHGlobal(MAX * 2);
        var pFilter = Marshal.StringToHGlobalUni(filter + "\0");
        var pTitle = Marshal.StringToHGlobalUni(title);
        var pDir = initialDir is null ? IntPtr.Zero : Marshal.StringToHGlobalUni(initialDir);
        var pExt = defExt is null ? IntPtr.Zero : Marshal.StringToHGlobalUni(defExt);
        try
        {
            var name = (defaultName ?? "") + "\0";
            var bytes = Encoding.Unicode.GetBytes(name);
            Marshal.Copy(new byte[MAX * 2], 0, file, MAX * 2);
            Marshal.Copy(bytes, 0, file, Math.Min(bytes.Length, MAX * 2 - 2));
            var ofn = new OPENFILENAME
            {
                lStructSize = (uint)Marshal.SizeOf<OPENFILENAME>(),
                hwndOwner = owner,
                lpstrFilter = pFilter,
                nFilterIndex = (uint)filterIndex,
                lpstrFile = file,
                nMaxFile = MAX,
                lpstrInitialDir = pDir,
                lpstrTitle = pTitle,
                lpstrDefExt = pExt,
                // OFN_EXPLORER | OFN_PATHMUSTEXIST | (save ? OVERWRITEPROMPT : FILEMUSTEXIST) | OFN_NOCHANGEDIR
                Flags = 0x80000 | 0x800 | (save ? 0x2u : 0x1000u) | 0x8,
            };
            var ok = save ? GetSaveFileName(ref ofn) : GetOpenFileName(ref ofn);
            return ok ? Marshal.PtrToStringUni(file) : null;
        }
        finally
        {
            Marshal.FreeHGlobal(file);
            Marshal.FreeHGlobal(pFilter);
            Marshal.FreeHGlobal(pTitle);
            if (pDir != IntPtr.Zero) Marshal.FreeHGlobal(pDir);
            if (pExt != IntPtr.Zero) Marshal.FreeHGlobal(pExt);
        }
    }
}
