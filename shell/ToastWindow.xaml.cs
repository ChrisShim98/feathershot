using System;
using System.Numerics;
using Feathershot.Services;
using Microsoft.UI.Composition;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Hosting;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.Graphics;
using Windows.UI.ViewManagement;
using WinRT.Interop;

namespace Feathershot;

public sealed partial class ToastWindow : Window
{
    private const int WidthDip = 380, HeightDip = 96, MarginDip = 16;

    private const int SystemToastClearanceDip = 118;

    private readonly PendingImage _image;
    private readonly DispatcherQueueTimer _timer;
    private readonly bool _animate = new UISettings().AnimationsEnabled;
    private bool _dismissing;

    public bool WasAccepted { get; private set; }
    internal event Action? Accepted;

    internal ToastWindow(PendingImage image)
    {
        InitializeComponent();
        _image = image;

        _timer = DispatcherQueue.CreateTimer();
        _timer.Interval = TimeSpan.FromSeconds(6);
        _timer.IsRepeating = false;
        _timer.Tick += (_, _) => Dismiss();

        ConfigureWindow();
        _ = LoadThumbnailAsync();
    }

    private async System.Threading.Tasks.Task LoadThumbnailAsync()
    {
        try
        {
            var src = new SoftwareBitmapSource();
            await src.SetBitmapAsync(_image.Bitmap);
            Thumb.Source = src;
        }
        catch { }
    }

    private void ConfigureWindow()
    {
        var hwnd = WindowNative.GetWindowHandle(this);

        var presenter = OverlappedPresenter.Create();
        presenter.IsResizable = false;
        presenter.IsMaximizable = false;
        presenter.IsMinimizable = false;
        presenter.IsAlwaysOnTop = true;
        presenter.SetBorderAndTitleBar(true, false);
        AppWindow.SetPresenter(presenter);
        AppWindow.IsShownInSwitchers = false;
        var ex = Win32.GetWindowLongPtr(hwnd, Win32.GWL_EXSTYLE).ToInt64();
        Win32.SetWindowLongPtr(hwnd, Win32.GWL_EXSTYLE, new IntPtr(ex | Win32.WS_EX_TOOLWINDOW | Win32.WS_EX_NOACTIVATE));

        Win32.GetCursorPos(out var cursor);
        var area = DisplayArea.GetFromPoint(new PointInt32(cursor.X, cursor.Y), DisplayAreaFallback.Nearest).WorkArea;
        var scale = Win32.GetDpiForWindow(hwnd) / 96.0;
        int w = (int)(WidthDip * scale), h = (int)(HeightDip * scale), m = (int)(MarginDip * scale);
        int clearance = (int)(SystemToastClearanceDip * scale);
        AppWindow.MoveAndResize(new RectInt32(area.X + area.Width - w - m, area.Y + area.Height - h - m - clearance, w, h));
    }

    internal void ShowToast()
    {
        var root = ElementCompositionPreview.GetElementVisual(Root);
        root.Opacity = 0;
        ElementCompositionPreview.SetIsTranslationEnabled(Root, true);
        root.Properties.InsertVector3("Translation", new Vector3(0, _animate ? 16 : 0, 0));

        AppWindow.Show(false);
        Sound.PlayToastChirp();

        var c = root.Compositor;
        var fade = c.CreateScalarKeyFrameAnimation();
        fade.InsertKeyFrame(1f, 1f);
        fade.Duration = TimeSpan.FromMilliseconds(220);
        root.StartAnimation("Opacity", fade);

        if (_animate)
        {
            var slide = c.CreateSpringVector3Animation();
            slide.FinalValue = Vector3.Zero;
            slide.DampingRatio = 0.7f;
            slide.Period = TimeSpan.FromMilliseconds(45);
            root.StartAnimation("Translation", slide);

            var bird = ElementCompositionPreview.GetElementVisual(BirdBox);
            ElementCompositionPreview.SetIsTranslationEnabled(BirdBox, true);
            var hop = c.CreateScalarKeyFrameAnimation();
            hop.InsertKeyFrame(0f, 0f);
            hop.InsertKeyFrame(0.45f, -10f, c.CreateCubicBezierEasingFunction(new Vector2(0.2f, 0.8f), new Vector2(0.4f, 1f)));
            hop.InsertKeyFrame(1f, 0f, c.CreateCubicBezierEasingFunction(new Vector2(0.6f, 0f), new Vector2(0.8f, 0.2f)));
            hop.Duration = TimeSpan.FromMilliseconds(320);
            hop.DelayTime = TimeSpan.FromMilliseconds(90);
            bird.StartAnimation("Translation.Y", hop);
        }

        _timer.Start();
    }

    internal void Dismiss(bool immediate = false)
    {
        if (_dismissing) return;
        _dismissing = true;
        _timer.Stop();

        if (immediate)
        {
            Close();
            return;
        }

        var root = ElementCompositionPreview.GetElementVisual(Root);
        var c = root.Compositor;
        var ease = c.CreateCubicBezierEasingFunction(new Vector2(0.5f, 0f), new Vector2(1f, 1f));
        var batch = c.CreateScopedBatch(CompositionBatchTypes.Animation);
        var fade = c.CreateScalarKeyFrameAnimation();
        fade.InsertKeyFrame(1f, 0f, ease);
        fade.Duration = TimeSpan.FromMilliseconds(160);
        root.StartAnimation("Opacity", fade);
        if (_animate)
        {
            var drift = c.CreateVector3KeyFrameAnimation();
            drift.InsertKeyFrame(1f, new Vector3(0, 12, 0), ease);
            drift.Duration = TimeSpan.FromMilliseconds(160);
            root.StartAnimation("Translation", drift);
        }
        batch.End();
        batch.Completed += (_, _) => DispatcherQueue.TryEnqueue(Close);
    }

    private void OnPointerEntered(object sender, PointerRoutedEventArgs e) => _timer.Stop();

    private void OnPointerExited(object sender, PointerRoutedEventArgs e)
    {
        if (!_dismissing) _timer.Start();
    }

    private void OnPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        if (_dismissing) return;
        WasAccepted = true;
        Accepted?.Invoke();
        Dismiss(immediate: true);
    }
}
