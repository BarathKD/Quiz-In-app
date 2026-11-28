using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Data;

namespace QuizIn.Api.Admin;

/// <summary>
/// Admin login and logout (base route: /admin).
/// Uses cookie login (scheme AdminHelpers.Scheme). Only users with IsAdmin = true can sign in.
/// Every POST needs an anti-forgery token (AutoValidateAntiforgeryToken), so Razor forms must include it.
/// </summary>
[Route("admin")]
[AutoValidateAntiforgeryToken]
public class AdminAccountController : Controller
{
    private readonly AppDbContext _db;

    public AdminAccountController(AppDbContext db) => _db = db;

    /// <summary>
    /// GET /admin/login - shows the empty login form (view: Views/AdminAccount/Login).
    /// </summary>
    [HttpGet("login")]
    [AllowAnonymous]
    public IActionResult Login() => View(new LoginVm());

    /// <summary>
    /// POST /admin/login - checks email + password and signs in with a cookie.
    /// Success: redirects to /admin (dashboard). Failure: shows the login view again with an error.
    /// Rate limited by the "login" policy (set in Program.cs) to slow down password guessing.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginVm vm)
    {
        // Emails are stored in lower case, so normalise the input before searching.
        var email = (vm.Email ?? "").Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Same message for "no user", "not admin" and "bad password" so attackers learn nothing.
        // The password is cleared so it is not sent back to the browser.
        if (user == null || !user.IsAdmin || !BCrypt.Net.BCrypt.Verify(vm.Password ?? "", user.PasswordHash))
        {
            vm.Password = null;
            vm.Error = "Wrong email or password.";
            return View(vm);
        }

        // Claims saved in the login cookie. The "Admin" role claim is what [Authorize(Roles = "Admin")] checks.
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, "Admin"),
        }, AdminHelpers.Scheme);

        await HttpContext.SignInAsync(AdminHelpers.Scheme, new ClaimsPrincipal(identity));
        return Redirect("/admin");
    }

    /// <summary>
    /// POST /admin/logout - removes the login cookie and redirects to /admin/login.
    /// </summary>
    [HttpPost("logout")]
    [Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(AdminHelpers.Scheme);
        return Redirect("/admin/login");
    }
}
