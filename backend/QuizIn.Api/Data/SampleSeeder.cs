using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Models;

namespace QuizIn.Api.Data;

// Loads the sample categories and questions that the mobile app used to ship with (Data/seed.json).
// Runs only when Seed:SampleContent is true AND the database has no categories yet.
public static class SampleSeeder
{
    // Shape of Data/seed.json. These small classes only exist to read that JSON file.
    private class SeedFile
    {
        public List<SeedCategory> Categories { get; set; } = new();
        public List<SeedQuestion> Questions { get; set; } = new();
    }

    private class SeedCategory
    {
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public double? BackgroundOpacity { get; set; }
        public int? Timer { get; set; }
        public List<string> Subcategories { get; set; } = new();
        public Dictionary<string, List<string>> Subjects { get; set; } = new();
        public Dictionary<string, int> SubjectTimers { get; set; } = new();
    }

    private class SeedOption
    {
        public string Id { get; set; } = "";
        public string Text { get; set; } = "";
    }

    // One sample question. Category / Subcategory / Subject are names, matched to rows created from SeedCategory.
    private class SeedQuestion
    {
        public string Category { get; set; } = "";
        public string Subcategory { get; set; } = "";
        public string? Subject { get; set; }
        public string Difficulty { get; set; } = "easy";
        public string QuestionText { get; set; } = "";
        public List<SeedOption> Options { get; set; } = new();
        public string CorrectOptionId { get; set; } = "";
        public string? Explanation { get; set; }
    }

    // Called once at startup from Program.cs. Does nothing if the seed file is missing or categories already exist,
    // so it never overwrites real content.
    public static async Task SeedAsync(AppDbContext db, string path)
    {
        if (!File.Exists(path) || await db.Categories.AnyAsync()) return;

        var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var seed = JsonSerializer.Deserialize<SeedFile>(await File.ReadAllTextAsync(path), json);
        if (seed == null) return;

        // Step 1: create categories, subcategories and subjects (with their timers). SortOrder keeps the order of the file.
        var order = 0;
        foreach (var c in seed.Categories)
        {
            var cat = new Category
            {
                Name = c.Name,
                Description = c.Description,
                BackgroundOpacity = c.BackgroundOpacity ?? 0.85,
                TimerMinutes = c.Timer ?? 5,
                SortOrder = order++,
            };
            foreach (var subName in c.Subcategories)
            {
                var sub = new Subcategory { Name = subName, Category = cat };
                if (c.Subjects.TryGetValue(subName, out var subjects))
                {
                    foreach (var s in subjects)
                    {
                        int? timer = c.SubjectTimers.TryGetValue(s, out var t) ? t : null;
                        sub.Subjects.Add(new Subject { Name = s, TimerMinutes = timer });
                    }
                }
                cat.Subcategories.Add(sub);
            }
            db.Categories.Add(cat);
        }
        await db.SaveChangesAsync();

        // Step 2: create the questions. A question whose category/subcategory/subject name is not found is skipped.
        // Options are stored as JSON text (OptionsJson).
        var subs = await db.Subcategories.Include(s => s.Category).Include(s => s.Subjects).ToListAsync();
        foreach (var q in seed.Questions)
        {
            var sub = subs.FirstOrDefault(s => s.Category!.Name == q.Category && s.Name == q.Subcategory);
            if (sub == null) continue;
            var subject = q.Subject == null ? null : sub.Subjects.FirstOrDefault(x => x.Name == q.Subject);
            if (q.Subject != null && subject == null) continue;

            db.Questions.Add(new Question
            {
                SubcategoryId = sub.Id,
                SubjectId = subject?.Id,
                Difficulty = q.Difficulty,
                QuestionText = q.QuestionText,
                OptionsJson = JsonSerializer.Serialize(q.Options, json),
                CorrectOptionId = q.CorrectOptionId,
                Explanation = q.Explanation,
            });
        }
        await db.SaveChangesAsync();
    }
}
