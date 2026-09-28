using System;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;

namespace Feathershot.Services;

/// <summary>A screenshot held in memory. The PNG is only encoded when the editor actually needs it.</summary>
internal sealed class PendingImage : IDisposable
{
    public required SoftwareBitmap Bitmap { get; init; }
    public required string Hash { get; init; }
    /// <summary>Original file bytes when the image came from disk; avoids a re-encode.</summary>
    public byte[]? FileBytes { get; init; }
    public int Width => Bitmap.PixelWidth;
    public int Height => Bitmap.PixelHeight;

    private byte[]? _png;

    public async Task<byte[]> GetBytesAsync()
    {
        if (FileBytes is not null) return FileBytes;
        return _png ??= await ImageUtil.EncodePngAsync(Bitmap);
    }

    public void Dispose() => Bitmap.Dispose();
}

internal static class ImageUtil
{
    public static async Task<SoftwareBitmap> DecodeAsync(IRandomAccessStream stream)
    {
        var decoder = await BitmapDecoder.CreateAsync(stream);
        return await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);
    }

    public static async Task<SoftwareBitmap> DecodeAsync(byte[] bytes)
    {
        using var ms = new InMemoryRandomAccessStream();
        await ms.WriteAsync(bytes.AsBuffer());
        ms.Seek(0);
        return await DecodeAsync(ms);
    }

    public static string Hash(SoftwareBitmap bmp)
    {
        var buf = new byte[bmp.PixelWidth * bmp.PixelHeight * 4];
        bmp.CopyToBuffer(buf.AsBuffer());
        return Convert.ToHexString(SHA256.HashData(buf));
    }

    public static async Task<byte[]> EncodePngAsync(SoftwareBitmap bmp)
    {
        using var straight = SoftwareBitmap.Convert(bmp, BitmapPixelFormat.Bgra8, BitmapAlphaMode.Straight);
        using var ms = new InMemoryRandomAccessStream();
        var enc = await BitmapEncoder.CreateAsync(BitmapEncoder.PngEncoderId, ms);
        enc.SetSoftwareBitmap(straight);
        await enc.FlushAsync();
        var bytes = new byte[ms.Size];
        ms.Seek(0);
        await ms.ReadAsync(bytes.AsBuffer(), (uint)ms.Size, InputStreamOptions.None);
        return bytes;
    }

    public static async Task<PendingImage> FromStreamAsync(IRandomAccessStream stream, byte[]? fileBytes = null)
    {
        var bmp = await DecodeAsync(stream);
        return new PendingImage { Bitmap = bmp, Hash = Hash(bmp), FileBytes = fileBytes };
    }

    public static async Task<PendingImage> FromFileBytesAsync(byte[] bytes)
    {
        var bmp = await DecodeAsync(bytes);
        return new PendingImage { Bitmap = bmp, Hash = Hash(bmp), FileBytes = bytes };
    }
}
