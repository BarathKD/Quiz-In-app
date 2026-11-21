namespace QuizIn.Api.Content;

// Saves admin-uploaded images (category / subject backgrounds) to disk.
// Folder: Uploads:Path from config, else <content root>/uploads. On a host with ephemeral disk, point it at persistent storage.
public class UploadStore
{
    public const long MaxBytes = 2 * 1024 * 1024;
    public string Root { get; }

    public UploadStore(IConfiguration config, IWebHostEnvironment env)
    {
        var configured = config["Uploads:Path"];
        Root = string.IsNullOrWhiteSpace(configured) ? Path.Combine(env.ContentRootPath, "uploads") : configured;
        Directory.CreateDirectory(Root);
    }

    // Returns (url, null) on success or (null, message) on a rejected file. File type is decided from the bytes, not the file name.
    public async Task<(string? Url, string? Error)> SaveImageAsync(IFormFile file)
    {
        if (file.Length == 0) return (null, "The image file is empty.");
        if (file.Length > MaxBytes) return (null, "Image is larger than 2 MB.");

        var bytes = new byte[file.Length];
        using (var stream = file.OpenReadStream())
        {
            var read = 0;
            while (read < bytes.Length)
            {
                var n = await stream.ReadAsync(bytes.AsMemory(read));
                if (n == 0) break;
                read += n;
            }
        }

        var ext = Sniff(bytes);
        if (ext == null) return (null, "Only PNG, JPG or WEBP images are allowed.");

        var name = Guid.NewGuid().ToString("N") + ext;
        await File.WriteAllBytesAsync(Path.Combine(Root, name), bytes);
        return ("/uploads/" + name, null);
    }

    public void Delete(string? url)
    {
        if (string.IsNullOrEmpty(url) || !url.StartsWith("/uploads/")) return;
        var path = Path.Combine(Root, Path.GetFileName(url));
        try { if (File.Exists(path)) File.Delete(path); } catch (IOException) { }
    }

    private static string? Sniff(byte[] b)
    {
        if (b.Length > 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return ".png";
        if (b.Length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return ".jpg";
        if (b.Length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return ".webp";
        return null;
    }
}
