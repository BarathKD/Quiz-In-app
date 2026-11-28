using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using QuizIn.Api.Models;

namespace QuizIn.Api.Auth;

/// <summary>
/// Creates the JWT login token that the mobile app sends in the "Authorization: Bearer ..." header.
/// Settings are read from the "Jwt" section (Key, Issuer, Audience, ExpiryDays).
/// Program.cs uses the same settings to validate the token.
/// </summary>
public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    /// <summary>Builds a signed token for this user (HMAC-SHA256). Expires after Jwt:ExpiryDays (default 7 days).</summary>
    public string Create(User user)
    {
        var jwt = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var descriptor = new SecurityTokenDescriptor
        {
            // Claims inside the token: user id, e-mail and role ("Admin" or "User"). Endpoints read the user id from here.
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.IsAdmin ? "Admin" : "User"),
            }),
            Issuer = jwt["Issuer"],
            Audience = jwt["Audience"],
            Expires = DateTime.UtcNow.AddDays(int.Parse(jwt["ExpiryDays"] ?? "7")),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}
