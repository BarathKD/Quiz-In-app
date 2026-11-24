using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuizIn.Api.Auth;
using QuizIn.Api.Content;
using QuizIn.Api.Admin;
using QuizIn.Api.Data;
using QuizIn.Api.Models;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// ---- Database: SQLite for development, SQL Server for production (Database:Provider) ----
var provider = builder.Configuration["Database:Provider"] ?? "Sqlite";
var connection = builder.Configuration.GetConnectionString("Default") ?? "Data Source=quizin.db";
builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (provider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase)) options.UseSqlServer(connection);
    else options.UseSqlite(connection);
});

// ---- JWT auth ----
var jwt = builder.Configuration.GetSection("Jwt");
var jwtKey = jwt["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be set and at least 32 characters (use an environment variable in production).");

builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<UploadStore>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwt["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    })
    // The admin web panel (/admin) signs in with a cookie; the mobile API keeps using JWT.
    .AddCookie("AdminCookie", options =>
    {
        options.LoginPath = "/admin/login";
        options.AccessDeniedPath = "/admin/login";
        options.Cookie.Name = "quizin_admin";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        // Redirect with a relative path: behind a proxy (Codespaces, Azure) the request host can be
        // "localhost", which would send the browser to the wrong place.
        options.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.Redirect(new Uri(ctx.RedirectUri).PathAndQuery);
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.Redirect(new Uri(ctx.RedirectUri).PathAndQuery);
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", p => p.RequireRole("Admin"));
});

builder.Services.AddControllersWithViews();
builder.Services.AddMemoryCache();
// Import preview posts one checkbox per row
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => o.ValueCountLimit = 20000);

// Behind a host's HTTPS proxy (Azure, Render, Codespaces) keep the real scheme so cookies are marked Secure
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Slow down password guessing: 10 login attempts per minute per IP
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

// ---- Create / update the database, then make sure the first admin exists ----
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.GetMigrations().Any()) db.Database.Migrate();
    else db.Database.EnsureCreated(); // first run before any migration has been created

    var adminEmail = builder.Configuration["Admin:Email"]?.Trim().ToLowerInvariant();
    var adminPassword = builder.Configuration["Admin:Password"];
    if (!string.IsNullOrEmpty(adminEmail) && !string.IsNullOrEmpty(adminPassword)
        && !db.Users.Any(u => u.Email == adminEmail))
    {
        db.Users.Add(new User
        {
            Email = adminEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
            IsAdmin = true,
        });
        db.SaveChanges();
    }

    // Development convenience: load the app's old sample categories into an empty database
    if (builder.Configuration.GetValue<bool>("Seed:SampleContent"))
        SampleSeeder.SeedAsync(db, Path.Combine(app.Environment.ContentRootPath, "Data", "seed.json")).GetAwaiter().GetResult();
}

app.UseForwardedHeaders();
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(app.Services.GetRequiredService<UploadStore>().Root),
    RequestPath = "/uploads"
});
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));
app.MapAuth();
app.MapContent();
app.MapUserData();
app.MapSettings();
app.MapControllers();
app.MapGet("/", () => Results.Redirect("/admin"));

app.Run();
