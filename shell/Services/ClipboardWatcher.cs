using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Windows.ApplicationModel.DataTransfer;

namespace Feathershot.Services;

/// <summary>
/// Listens for clipboard changes with AddClipboardFormatListener on a hidden message-only window.
/// No polling: Windows sends WM_CLIPBOARDUPDATE. The format is checked first, and the data is only
/// read and hashed when it is an image.
/// </summary>
internal sealed class ClipboardWatcher : IDisposable
{
    private const string ClassName = "FeathershotClipboardWindow";
    private static readonly uint PngFormat = Win32.RegisterClipboardFormat("PNG");

    private readonly ScreenshotIntake _intake;
    private readonly Win32.WndProc _proc; // kept alive for the lifetime of the window
    private IntPtr _hwnd;
    private bool _listening;
    private uint _ownSequence;

    public ClipboardWatcher(ScreenshotIntake intake)
    {
        _intake = intake;
        _proc = WndProc;
        var hInst = Win32.GetModuleHandle(null);
        var pName = Marshal.StringToHGlobalUni(ClassName);
        var wc = new Win32.WNDCLASSEX
        {
            cbSize = (uint)Marshal.SizeOf<Win32.WNDCLASSEX>(),
            lpfnWndProc = Marshal.GetFunctionPointerForDelegate(_proc),
            hInstance = hInst,
            lpszClassName = pName,
        };
        Win32.RegisterClassEx(ref wc);
        _hwnd = Win32.CreateWindowEx(0, pName, IntPtr.Zero, 0, 0, 0, 0, 0, Win32.HWND_MESSAGE, IntPtr.Zero, hInst, IntPtr.Zero);
    }

    public bool Enabled
    {
        get => _listening;
        set
        {
            if (value == _listening || _hwnd == IntPtr.Zero) return;
            _listening = value ? Win32.AddClipboardFormatListener(_hwnd) : !Win32.RemoveClipboardFormatListener(_hwnd);
        }
    }

    /// <summary>Called after Feathershot sets the clipboard itself, so its own change events are ignored.</summary>
    public void MarkOwnChange() => _ownSequence = Win32.GetClipboardSequenceNumber();

    private IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        if (msg == Win32.WM_CLIPBOARDUPDATE) _ = OnClipboardChangedAsync();
        return Win32.DefWindowProc(hwnd, msg, wParam, lParam);
    }

    private static bool HasImageFormat() =>
        Win32.IsClipboardFormatAvailable(8) ||   // CF_DIB
        Win32.IsClipboardFormatAvailable(17) ||  // CF_DIBV5
        Win32.IsClipboardFormatAvailable(2) ||   // CF_BITMAP
        (PngFormat != 0 && Win32.IsClipboardFormatAvailable(PngFormat));

    private async Task OnClipboardChangedAsync()
    {
        try
        {
            if (!_listening) return;
            if (_ownSequence != 0 && Win32.GetClipboardSequenceNumber() == _ownSequence) return;
            if (!HasImageFormat()) return;

            // Another app may still hold the clipboard open right after copying; retry briefly.
            for (int attempt = 0; attempt < 4; attempt++)
            {
                try
                {
                    var content = Clipboard.GetContent();
                    if (!content.Contains(StandardDataFormats.Bitmap)) return;
                    var reference = await content.GetBitmapAsync();
                    using var stream = await reference.OpenReadAsync();
                    var img = await ImageUtil.FromStreamAsync(stream);
                    _intake.Offer(img, ImageSource.Clipboard);
                    return;
                }
                catch
                {
                    await Task.Delay(60 * (attempt + 1));
                }
            }
        }
        catch { /* a failed read must never take the tray app down */ }
    }

    public void Dispose()
    {
        Enabled = false;
        if (_hwnd != IntPtr.Zero) Win32.DestroyWindow(_hwnd);
        _hwnd = IntPtr.Zero;
    }
}
