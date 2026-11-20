using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Data;

namespace QuizIn.Api.Admin;

[Route("admin")]
[AutoValidateAntiforgeryToken]
public class AdminAccountController : Controller
{
    private readonly AppDbContext _db;

    public AdminAccountController(AppDbContext db) => _db = db;

    [HttpGet("login")]
    [AllowAnonymous]
    public IActionResult Login() => View(new LoginVm());

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginVm vm)
    {
        var email = (vm.Email ?? "").Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null || !user.IsAdmin || !BCrypt.Net.BCrypt.Verify(vm.Password ?? "", user.PasswordHash))
        {
            vm.Password = null;
            vm.Error = "Wrong email or password.";
            return View(vm);
        }

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, "Admin"),
        }, AdminHelpers.Scheme);

        await HttpContext.SignInAsync(AdminHelpers.Scheme, new ClaimsPrincipal(identity));
        return Redirect("/admin");
    }

    [HttpPost("logout")]
    [Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(AdminHelpers.Scheme);
        return Redirect("/admin/login");
    }
}
