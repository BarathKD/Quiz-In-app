using QuizIn.Api.Data;
using QuizIn.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace QuizIn.Api.Admin;

public class LoginVm
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? Error { get; set; }
}

public record CategoryStat(string Name, int Easy, int Medium, int Hard)
{
    public int Total => Easy + Medium + Hard;
}

public class DashboardVm
{
    public int Users { get; set; }
    public int Categories { get; set; }
    public int Questions { get; set; }
    public int LevelsPassed { get; set; }
    public List<CategoryStat> Stats { get; set; } = new();
}

public record LocationOption(string Value, string Label);

public class QuestionListVm
{
    public List<Question> Items { get; set; } = new();
    public List<LocationOption> Locations { get; set; } = new();
    public string? Target { get; set; }
    public string? Difficulty { get; set; }
    public int Page { get; set; }
    public int TotalPages { get; set; }
    public int Total { get; set; }
}

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

public class ImportVm
{
    public string? Category { get; set; }
    public string? Subcategory { get; set; }
    public string? Subject { get; set; }
    public string? Difficulty { get; set; } = "easy";
    public string? Error { get; set; }
    public int? Added { get; set; }
    public List<string>? Skipped { get; set; }
    public List<string> Categories { get; set; } = new();
}

public static class AdminHelpers
{
    public const string Scheme = "AdminCookie";

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
