using System.Net.Mail;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Auth;

public record RegisterRequest(string? Email, string? Password);
public record LoginRequest(string? Email, string? Password);
public record UserDto(Guid Id, string Email, bool IsAdmin);
public record AuthResponse(string Token, UserDto User);

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
        });

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
