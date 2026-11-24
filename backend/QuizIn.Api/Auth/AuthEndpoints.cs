using System.Net.Mail;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Auth;

public record RegisterRequest(string? Email, string? Password);
public record LoginRequest(string? Email, string? Password);
public record UserDto(Guid Id, string Email, bool IsAdmin);
public record AuthResponse(string Token, UserDto User);
public record ForgotRequest(string? Email);
public record ResetRequest(string? Email, string? Code, string? NewPassword);

public static class AuthEndpoints
{
    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/register", async (RegisterRequest req, AppDbContext db, TokenService tokens) =>
        {
            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            var password = req.Password ?? "";

            if (!IsValidEmail(email)) return Results.BadRequest(new { error = "invalid_email" });
            if (password.Length < 6) return Results.BadRequest(new { error = "weak_password" });
            if (await db.Users.AnyAsync(u => u.Email == email)) return Results.Conflict(new { error = "email_taken" });

            var user = new User { Email = email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password) };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            return Results.Ok(new AuthResponse(tokens.Create(user), ToDto(user)));
        });

        group.MapPost("/login", async (LoginRequest req, AppDbContext db, TokenService tokens) =>
        {
            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

            // Same answer for unknown email and wrong password
            if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password ?? "", user.PasswordHash))
                return Results.Unauthorized();

            return Results.Ok(new AuthResponse(tokens.Create(user), ToDto(user)));
        }).RequireRateLimiting("login");

        // Step 1: e-mail a 6-digit code. The answer is always the same, so nobody can use this to find out who has an account.
        group.MapPost("/forgot", async (ForgotRequest req, AppDbContext db, IEmailSender mail, IHostEnvironment env, ILogger<ForgotRequest> log) =>
        {
            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            string? devCode = null;

            var user = IsValidEmail(email) ? await db.Users.FirstOrDefaultAsync(u => u.Email == email) : null;
            if (user != null)
            {
                var now = DateTime.UtcNow;
                var recent = await db.PasswordResets.AnyAsync(r => r.UserId == user.Id && r.CreatedAt > now.AddSeconds(-60));
                if (!recent)
                {
                    // Older codes stop working
                    await db.PasswordResets.Where(r => r.UserId == user.Id && !r.Used).ExecuteUpdateAsync(s => s.SetProperty(r => r.Used, true));

                    var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
                    db.PasswordResets.Add(new PasswordReset
                    {
                        UserId = user.Id,
                        CodeHash = BCrypt.Net.BCrypt.HashPassword(code, workFactor: 8),
                        ExpiresAt = now.AddMinutes(15),
                    });
                    await db.SaveChangesAsync();

                    try
                    {
                        await mail.SendAsync(user.Email, "Quiz-IN password reset code",
                            $"Your Quiz-IN password reset code is {code}.\nIt works for 15 minutes. If you did not ask for it, ignore this e-mail.");
                    }
                    catch (Exception ex)
                    {
                        log.LogError(ex, "Could not send the password reset e-mail");
                    }
                    if (env.IsDevelopment()) devCode = code; // lets the smoke test run without a mail server
                }
            }
            return Results.Ok(new { ok = true, devCode });
        }).RequireRateLimiting("reset");

        // Step 2: the code plus a new password.
        group.MapPost("/reset", async (ResetRequest req, AppDbContext db) =>
        {
            var email = (req.Email ?? "").Trim().ToLowerInvariant();
            var password = req.NewPassword ?? "";
            if (password.Length < 6) return Results.BadRequest(new { error = "weak_password" });

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            var now = DateTime.UtcNow;
            var reset = user == null ? null : await db.PasswordResets
                .Where(r => r.UserId == user.Id && !r.Used && r.ExpiresAt > now)
                .OrderByDescending(r => r.Id).FirstOrDefaultAsync();
            if (user == null || reset == null) return Results.BadRequest(new { error = "invalid_code" });

            if (reset.Attempts >= 5)
            {
                reset.Used = true;
                await db.SaveChangesAsync();
                return Results.BadRequest(new { error = "invalid_code" });
            }
            if (!BCrypt.Net.BCrypt.Verify((req.Code ?? "").Trim(), reset.CodeHash))
            {
                reset.Attempts++;
                await db.SaveChangesAsync();
                return Results.BadRequest(new { error = "invalid_code" });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            reset.Used = true;
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireRateLimiting("reset");

        group.MapGet("/me", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            var user = await CurrentUser(principal, db);
            return user == null ? Results.Unauthorized() : Results.Ok(ToDto(user));
        }).RequireAuthorization();

        // Play Store requires account deletion. Related data cascades in the database.
        group.MapDelete("/me", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            var user = await CurrentUser(principal, db);
            if (user == null) return Results.Unauthorized();
            if (user.IsAdmin) return Results.BadRequest(new { error = "admin_cannot_be_deleted" });

            db.Users.Remove(user);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization();
    }

    public static Guid? UserId(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private static async Task<User?> CurrentUser(ClaimsPrincipal principal, AppDbContext db)
    {
        var id = UserId(principal);
        return id == null ? null : await db.Users.FindAsync(id.Value);
    }

    private static UserDto ToDto(User u) => new(u.Id, u.Email, u.IsAdmin);

    private static bool IsValidEmail(string email) =>
        email.Length <= 256 && MailAddress.TryCreate(email, out var addr) && addr.Address == email;
}
