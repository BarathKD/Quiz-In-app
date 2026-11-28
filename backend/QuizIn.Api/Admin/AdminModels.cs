using QuizIn.Api.Data;
using QuizIn.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace QuizIn.Api.Admin;

// View models (Vm) = plain data classes passed between controllers and Razor views in Views/Admin*.
// They are NOT database tables. Database entities live in QuizIn.Api.Models.

/// <summary>
/// Data for the login form (Views/AdminAccount/Login). Error is shown when login fails.
/// </summary>
public class LoginVm
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// One dashboard row: number of questions per difficulty for one category.
/// </summary>
public record CategoryStat(string Name, int Easy, int Medium, int Hard)
{
    // Total is calculated, not stored.
    public int Total => Easy + Medium + Hard;
}

/// <summary>
/// Data for the dashboard page (GET /admin): total counts and the per-category stats table.
/// </summary>
public class DashboardVm
{
    public int Users { get; set; }
    public int Categories { get; set; }
    public int Questions { get; set; }
    public int LevelsPassed { get; set; }
    public List<CategoryStat> Stats { get; set; } = new();
}

/// <summary>
/// One entry of a "where does this question belong" dropdown.
/// Value is "subcategoryId-subjectId" (see AdminHelpers.TryParseTarget). Label is the text the admin sees.
/// </summary>
public record LocationOption(string Value, string Label);

/// <summary>
/// Data for the question list page (GET /admin/questions): one page of questions,
/// the current filters (Target, Difficulty, Search) and paging numbers.
/// </summary>
public class QuestionListVm
{
    public List<Question> Items { get; set; } = new();
    public List<LocationOption> Locations { get; set; } = new();
    public string? Target { get; set; }
    public string? Difficulty { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; }
    public int TotalPages { get; set; }
    public int Total { get; set; }
}

/// <summary>
/// Data for the add/edit question form. Id is null when adding a new question.
/// Correct holds the right answer letter: "a", "b", "c" or "d".
/// </summary>
public class QuestionFormVm
{
    public int? Id { get; set; }
    public string? Target { get; set; }
    public string? Difficulty { get; set; } = "easy";
    public string? QuestionText { get; set; }
    public string? OptionA { get; set; }
    public string? OptionB { get; set; }
    public string? OptionC { get; set; }
    public string? OptionD { get; set; }
    public string? Correct { get; set; } = "a";
    public string? Explanation { get; set; }
    public string? Error { get; set; }
    public List<LocationOption> Locations { get; set; } = new();
}

/// <summary>
/// Data for the bulk import page (Views/AdminImport). Holds the pasted text, chosen format
/// (csv/json), default category/subcategory/subject/difficulty, and the result
/// (Added count and Skipped messages) after an import.
/// </summary>
public class ImportVm
{
    public string? Category { get; set; }
    public string? Subcategory { get; set; }
    public string? Subject { get; set; }
    public string? Difficulty { get; set; } = "easy";
    public string? Format { get; set; } = "csv";
    public string? Text { get; set; }
    public string? Error { get; set; }
    public int? Added { get; set; }
    public List<string>? Skipped { get; set; }
    public List<string> Categories { get; set; } = new();
    public List<ImportCategoryNode> Tree { get; set; } = new();
}

// Category > subcategories > subjects, used by the import page dropdowns
public record ImportSubNode(string Name, List<string> Subjects);
public record ImportCategoryNode(string Name, List<ImportSubNode> Subs);

/// <summary>
/// Small shared helpers for the admin controllers.
/// </summary>
public static class AdminHelpers
{
    // Name of the cookie authentication scheme. Must match the registration in Program.cs.
    public const string Scheme = "AdminCookie";

    /// <summary>
    /// Builds the location dropdown list from the database (read-only query).
    /// </summary>
    // Dropdown entries: "subcategoryId-subjectId" (subjectId 0 = no subject)
    public static async Task<List<LocationOption>> GetLocations(AppDbContext db)
    {
        var subs = await db.Subcategories.AsNoTracking()
            .Include(s => s.Category).Include(s => s.Subjects)
            .OrderBy(s => s.Category!.Name).ThenBy(s => s.Name)
            .ToListAsync();

        var list = new List<LocationOption>();
        foreach (var s in subs)
        {
            list.Add(new LocationOption($"{s.Id}-0", $"{s.Category!.Name} › {s.Name}"));
            foreach (var subj in s.Subjects.OrderBy(x => x.Name))
                list.Add(new LocationOption($"{s.Id}-{subj.Id}", $"{s.Category.Name} › {s.Name} › {subj.Name}"));
        }
        return list;
    }

    /// <summary>
    /// Reverse of GetLocations: turns "12-5" into subcategoryId 12 and subjectId 5.
    /// Subject part 0 means "no subject", so subjectId becomes null. Returns false if the text is not valid.
    /// </summary>
    public static bool TryParseTarget(string? value, out int subcategoryId, out int? subjectId)
    {
        subcategoryId = 0;
        subjectId = null;
        if (string.IsNullOrEmpty(value)) return false;
        var parts = value.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[0], out subcategoryId) || !int.TryParse(parts[1], out var subj)) return false;
        subjectId = subj == 0 ? null : subj;
        return true;
    }
}

/// <summary>
/// One row of the users table: id, email, sign-up date and how many levels the user passed.
/// </summary>
public record UserRow(Guid Id, string Email, DateTime CreatedAt, int LevelsPassed);

/// <summary>
/// Data for the users page (GET /admin/users): one page of users, the search text and paging numbers.
/// </summary>
public class UsersVm
{
    public List<UserRow> Items { get; set; } = new();
    public string? Search { get; set; }
    public int Page { get; set; }
    public int TotalPages { get; set; }
    public int Total { get; set; }
}
