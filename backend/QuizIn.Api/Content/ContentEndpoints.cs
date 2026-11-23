using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Content;

// The JSON shapes below mirror what the mobile app already uses locally
// (category.subcategories = names, category.subjects = { subcategory: [names] }, question.options = [{id,text}]),
// so utils/api.js can switch from AsyncStorage to these endpoints with a thin mapping.
public record CategoryDto(
    int Id, string Name, string? Description, double BackgroundOpacity, int Timer,
    List<string> Subcategories,
    Dictionary<string, List<string>> Subjects,
    Dictionary<string, int> SubjectTimers,
    string? ImageUrl,
    Dictionary<string, string> SubjectImages);

public record OptionDto(string Id, string Text);

public record QuestionDto(
    int Id, string Category, string Subcategory, string? Subject, string Difficulty,
    string QuestionText, List<OptionDto> Options, string CorrectOptionId, string? Explanation);

public record CategoryInput(string? Name, string? Description, int? TimerMinutes, double? BackgroundOpacity, int? SortOrder);
public record NameInput(string? Name, int? TimerMinutes);
public record QuestionInput(
    string? Category, string? Subcategory, string? Subject, string? Difficulty,
    string? QuestionText, List<OptionDto>? Options, string? CorrectOptionId, string? Explanation);

public static class ContentEndpoints
{
    private static readonly string[] Difficulties = { "easy", "medium", "hard" };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static void MapContent(this IEndpointRouteBuilder app)
    {
        // ---------- Read (any logged-in user) ----------
        var read = app.MapGroup("/api").RequireAuthorization();

        read.MapGet("/categories", async (AppDbContext db) =>
        {
            var cats = await db.Categories.AsNoTracking()
                .Include(c => c.Subcategories).ThenInclude(s => s.Subjects)
                .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
                .ToListAsync();

            return Results.Ok(cats.Select(c => new CategoryDto(
                c.Id, c.Name, c.Description, c.BackgroundOpacity, c.TimerMinutes,
                c.Subcategories.OrderBy(s => s.Id).Select(s => s.Name).ToList(),
                c.Subcategories.Where(s => s.Subjects.Count > 0)
                    .ToDictionary(s => s.Name, s => s.Subjects.OrderBy(x => x.Id).Select(x => x.Name).ToList()),
                c.Subcategories.SelectMany(s => s.Subjects).Where(x => x.TimerMinutes != null)
                    .GroupBy(x => x.Name).ToDictionary(g => g.Key, g => g.First().TimerMinutes!.Value),
                c.ImageUrl,
                c.Subcategories.SelectMany(s => s.Subjects).Where(x => x.ImageUrl != null)
                    .GroupBy(x => x.Name).ToDictionary(g => g.Key, g => g.First().ImageUrl!))));
        });

        // ?subject= (present but empty) -> only questions without a subject; parameter absent -> any subject.
        read.MapGet("/questions", async (HttpRequest req, AppDbContext db,
            string? category, string? subcategory, string? subject, string? difficulty) =>
        {
            var q = QuestionQuery(db);
            if (!string.IsNullOrEmpty(category)) q = q.Where(x => x.Subcategory!.Category!.Name == category);
            if (!string.IsNullOrEmpty(subcategory)) q = q.Where(x => x.Subcategory!.Name == subcategory);
            if (!string.IsNullOrEmpty(difficulty)) q = q.Where(x => x.Difficulty == difficulty);
            if (req.Query.ContainsKey("subject"))
            {
                if (string.IsNullOrEmpty(subject)) q = q.Where(x => x.SubjectId == null);
                else q = q.Where(x => x.Subject != null && x.Subject.Name == subject);
            }
            // Stable order: the app slices this list into levels of 50
            var list = await q.OrderBy(x => x.Id).ToListAsync();
            return Results.Ok(list.Select(ToDto));
        });

        // ---------- Admin ----------
        var admin = app.MapGroup("/api/admin").RequireAuthorization("Admin");

        admin.MapPost("/categories", async (CategoryInput input, AppDbContext db) =>
        {
            var name = input.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest(new { error = "name_required" });
            if (await db.Categories.AnyAsync(c => c.Name == name)) return Results.Conflict(new { error = "category_exists" });
            var cat = new Category
            {
                Name = name,
                Description = input.Description?.Trim(),
                TimerMinutes = input.TimerMinutes ?? 5,
                BackgroundOpacity = input.BackgroundOpacity ?? 0.85,
                SortOrder = input.SortOrder ?? 0,
            };
            db.Categories.Add(cat);
            await db.SaveChangesAsync();
            return Results.Ok(new { id = cat.Id });
        });

        admin.MapPut("/categories/{id:int}", async (int id, CategoryInput input, AppDbContext db) =>
        {
            var cat = await db.Categories.FindAsync(id);
            if (cat == null) return Results.NotFound();
            var name = input.Name?.Trim();
            if (!string.IsNullOrEmpty(name) && name != cat.Name)
            {
                if (await db.Categories.AnyAsync(c => c.Name == name)) return Results.Conflict(new { error = "category_exists" });
                cat.Name = name;
            }
            if (input.Description != null) cat.Description = input.Description.Trim();
            if (input.TimerMinutes != null) cat.TimerMinutes = input.TimerMinutes.Value;
            if (input.BackgroundOpacity != null) cat.BackgroundOpacity = input.BackgroundOpacity.Value;
            if (input.SortOrder != null) cat.SortOrder = input.SortOrder.Value;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        admin.MapDelete("/categories/{id:int}", async (int id, AppDbContext db) =>
        {
            var cat = await db.Categories.FindAsync(id);
            if (cat == null) return Results.NotFound();
            db.Categories.Remove(cat); // subcategories, subjects, questions, progress cascade in the database
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        admin.MapPost("/categories/{categoryId:int}/subcategories", async (int categoryId, NameInput input, AppDbContext db) =>
        {
            var name = input.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest(new { error = "name_required" });
            if (!await db.Categories.AnyAsync(c => c.Id == categoryId)) return Results.NotFound();
            if (await db.Subcategories.AnyAsync(s => s.CategoryId == categoryId && s.Name == name))
                return Results.Conflict(new { error = "subcategory_exists" });
            var sub = new Subcategory { CategoryId = categoryId, Name = name };
            db.Subcategories.Add(sub);
            await db.SaveChangesAsync();
            return Results.Ok(new { id = sub.Id });
        });

        admin.MapDelete("/subcategories/{id:int}", async (int id, AppDbContext db) =>
        {
            var sub = await db.Subcategories.FindAsync(id);
            if (sub == null) return Results.NotFound();
            db.Subcategories.Remove(sub);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        admin.MapPost("/subcategories/{subcategoryId:int}/subjects", async (int subcategoryId, NameInput input, AppDbContext db) =>
        {
            var name = input.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest(new { error = "name_required" });
            if (!await db.Subcategories.AnyAsync(s => s.Id == subcategoryId)) return Results.NotFound();
            if (await db.Subjects.AnyAsync(s => s.SubcategoryId == subcategoryId && s.Name == name))
                return Results.Conflict(new { error = "subject_exists" });
            var subject = new Subject { SubcategoryId = subcategoryId, Name = name, TimerMinutes = input.TimerMinutes };
            db.Subjects.Add(subject);
            await db.SaveChangesAsync();
            return Results.Ok(new { id = subject.Id });
        });

        admin.MapDelete("/subjects/{id:int}", async (int id, AppDbContext db) =>
        {
            if (!await db.Subjects.AnyAsync(s => s.Id == id)) return Results.NotFound();
            // Subject links are NoAction in the database, so remove dependants first
            await db.Questions.Where(q => q.SubjectId == id).ExecuteDeleteAsync();
            await db.LevelProgress.Where(p => p.SubjectId == id).ExecuteDeleteAsync();
            await db.Subjects.Where(s => s.Id == id).ExecuteDeleteAsync();
            return Results.NoContent();
        });

        admin.MapPost("/questions", async (QuestionInput input, AppDbContext db) =>
        {
            var error = Validate(input);
            if (error != null) return Results.BadRequest(new { error });

            var target = await Resolve(db, input.Category!, input.Subcategory!, input.Subject, create: false);
            if (target.Error != null) return Results.BadRequest(new { error = target.Error });

            var question = new Question
            {
                SubcategoryId = target.Subcategory!.Id,
                SubjectId = target.Subject?.Id,
                Difficulty = input.Difficulty!.ToLowerInvariant(),
                QuestionText = input.QuestionText!.Trim(),
                OptionsJson = JsonSerializer.Serialize(input.Options, Json),
                CorrectOptionId = input.CorrectOptionId!,
                Explanation = input.Explanation?.Trim(),
            };
            db.Questions.Add(question);
            await db.SaveChangesAsync();
            return Results.Ok(new { id = question.Id });
        });

        admin.MapPut("/questions/{id:int}", async (int id, QuestionInput input, AppDbContext db) =>
        {
            var question = await db.Questions.FindAsync(id);
            if (question == null) return Results.NotFound();
            var error = Validate(input, requireTarget: false);
            if (error != null) return Results.BadRequest(new { error });

            question.Difficulty = input.Difficulty!.ToLowerInvariant();
            question.QuestionText = input.QuestionText!.Trim();
            question.OptionsJson = JsonSerializer.Serialize(input.Options, Json);
            question.CorrectOptionId = input.CorrectOptionId!;
            question.Explanation = input.Explanation?.Trim();
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        admin.MapDelete("/questions/{id:int}", async (int id, AppDbContext db) =>
        {
            var deleted = await db.Questions.Where(q => q.Id == id).ExecuteDeleteAsync();
            return deleted == 0 ? Results.NotFound() : Results.NoContent();
        });

        // Body = raw CSV text. Columns: id, question, A, B, C, D, correct answer (A-D, 1-4 or the answer text), explanation
        admin.MapPost("/import/csv", async (HttpRequest req, AppDbContext db,
            string category, string subcategory, string? subject, string? difficulty) =>
        {
            using var reader = new StreamReader(req.Body);
            var csv = await reader.ReadToEndAsync();
            var result = await ImportCsvAsync(db, csv, category, subcategory, subject, difficulty ?? "easy");
            return result.Error != null
                ? Results.BadRequest(new { error = result.Error })
                : Results.Ok(new { added = result.Added, skipped = result.Skipped });
        });

        admin.MapPost("/import/json", async (HttpRequest req, AppDbContext db,
            string category, string subcategory, string? subject, string? difficulty) =>
        {
            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            var result = await ImportJsonAsync(db, body, category, subcategory, subject, difficulty ?? "easy");
            return result.Error != null
                ? Results.BadRequest(new { error = result.Error })
                : Results.Ok(new { added = result.Added, skipped = result.Skipped });
        });
    }

    public record ImportResult(int Added, List<string> Skipped, string? Error);

    // JSON body: an array of { questionText, options: [{id,text}], correctOptionId, explanation } (same as the app's old JSON import)
    public static async Task<ImportResult> ImportJsonAsync(
        AppDbContext db, string json, string category, string subcategory, string? subject, string difficulty)
    {
        var diff = difficulty.ToLowerInvariant();
        if (!Difficulties.Contains(diff)) return new ImportResult(0, new List<string>(), "invalid_difficulty");

        List<QuestionInput>? items;
        try { items = JsonSerializer.Deserialize<List<QuestionInput>>(json, Json); }
        catch (JsonException) { return new ImportResult(0, new List<string>(), "invalid_json"); }
        if (items == null || items.Count == 0) return new ImportResult(0, new List<string>(), "json_empty");

        var valid = new List<QuestionInput>();
        var skipped = new List<string>();
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i] with { Difficulty = diff };
            var error = Validate(item, requireTarget: false);
            if (error != null) { skipped.Add($"Item {i + 1}: {error}"); continue; }
            valid.Add(item);
        }
        if (valid.Count == 0) return new ImportResult(0, skipped, null);

        var target = await Resolve(db, category, subcategory, subject, create: true);
        if (target.Error != null) return new ImportResult(0, skipped, target.Error);

        db.Questions.AddRange(valid.Select(item => new Question
        {
            SubcategoryId = target.Subcategory!.Id,
            SubjectId = target.Subject?.Id,
            Difficulty = diff,
            QuestionText = item.QuestionText!.Trim(),
            OptionsJson = JsonSerializer.Serialize(item.Options, Json),
            CorrectOptionId = item.CorrectOptionId!,
            Explanation = string.IsNullOrWhiteSpace(item.Explanation) ? null : item.Explanation.Trim(),
        }));
        await db.SaveChangesAsync();
        return new ImportResult(valid.Count, skipped, null);
    }

    // Shared by the API endpoint and the admin web page.
    public static Task<ImportResult> ImportCsvAsync(
        AppDbContext db, string csv, string category, string subcategory, string? subject, string difficulty)
        => ImportRowsAsync(db, CsvParser.Parse(csv), category, subcategory, subject, difficulty);

    // .xlsx: first worksheet, same columns as the CSV (id, question, A, B, C, D, answer, explanation)
    public static Task<ImportResult> ImportXlsxAsync(
        AppDbContext db, Stream xlsx, string category, string subcategory, string? subject, string difficulty)
    {
        List<List<string>> rows;
        try { rows = XlsxReader.ReadFirstSheet(xlsx); }
        catch (Exception ex) when (ex is InvalidDataException or System.Xml.XmlException or IOException)
        {
            return Task.FromResult(new ImportResult(0, new List<string>(), "invalid_xlsx"));
        }
        return ImportRowsAsync(db, rows, category, subcategory, subject, difficulty);
    }

    private static async Task<ImportResult> ImportRowsAsync(
        AppDbContext db, List<List<string>> allRows, string category, string subcategory, string? subject, string difficulty)
    {
        var diff = difficulty.ToLowerInvariant();
        if (!Difficulties.Contains(diff)) return new ImportResult(0, new List<string>(), "invalid_difficulty");

        var rows = allRows.Where(r => r.Any(c => c != "")).ToList();
        if (rows.Count == 0) return new ImportResult(0, new List<string>(), "file_empty");

        var target = await Resolve(db, category, subcategory, subject, create: true);
        if (target.Error != null) return new ImportResult(0, new List<string>(), target.Error);

        var first = rows[0];
        var c0 = first[0].Trim().ToLowerInvariant();
        var c1 = first.Count > 1 ? first[1].Trim().ToLowerInvariant() : "";
        var isHeader = c0 is "id" or "s.no" or "sno" || c0.Contains("serial") || c1.Contains("question")
            || first.Any(c => c.Trim().ToLowerInvariant() is "answer" or "explanation");

        var added = new List<Question>();
        var skipped = new List<string>();
        var letters = new[] { "a", "b", "c", "d" };
        for (var i = isHeader ? 1 : 0; i < rows.Count; i++)
        {
            var row = rows[i];
            string Col(int n) => n < row.Count ? row[n].Trim() : "";
            if (row.Count < 6) { skipped.Add($"Row {i + 1}: missing columns"); continue; }
            if (Col(0) == "" || Col(1) == "" || Col(2) == "" || Col(3) == "" || Col(6) == "")
            { skipped.Add($"Row {i + 1}: missing required fields"); continue; }

            var options = new List<OptionDto>();
            for (var k = 0; k < 4; k++)
                if (Col(2 + k) != "") options.Add(new OptionDto(letters[k], Col(2 + k)));

            var correct = MatchCorrect(Col(6), Col(2), Col(3), Col(4), Col(5));
            if (correct == null || !options.Any(o => o.Id == correct))
            { skipped.Add($"Row {i + 1}: correct answer not recognised"); continue; }

            added.Add(new Question
            {
                SubcategoryId = target.Subcategory!.Id,
                SubjectId = target.Subject?.Id,
                Difficulty = diff,
                QuestionText = Col(1),
                OptionsJson = JsonSerializer.Serialize(options, Json),
                CorrectOptionId = correct,
                Explanation = Col(7) == "" ? null : Col(7),
            });
        }

        db.Questions.AddRange(added);
        await db.SaveChangesAsync();
        return new ImportResult(added.Count, skipped, null);
    }

    // ---------- helpers ----------
    internal static IQueryable<Question> QuestionQuery(AppDbContext db) =>
        db.Questions.AsNoTracking()
            .Include(x => x.Subcategory).ThenInclude(s => s!.Category)
            .Include(x => x.Subject);

    internal static QuestionDto ToDto(Question q) => new(
        q.Id, q.Subcategory!.Category!.Name, q.Subcategory.Name, q.Subject?.Name, q.Difficulty,
        q.QuestionText,
        JsonSerializer.Deserialize<List<OptionDto>>(q.OptionsJson, Json) ?? new List<OptionDto>(),
        q.CorrectOptionId, q.Explanation);

    private static string? Validate(QuestionInput i, bool requireTarget = true)
    {
        if (requireTarget && (string.IsNullOrWhiteSpace(i.Category) || string.IsNullOrWhiteSpace(i.Subcategory))) return "category_required";
        if (string.IsNullOrWhiteSpace(i.QuestionText)) return "question_required";
        if (i.Difficulty == null || !Difficulties.Contains(i.Difficulty.ToLowerInvariant())) return "invalid_difficulty";
        if (i.Options == null || i.Options.Count < 2 || i.Options.Count > 4) return "options_2_to_4";
        if (i.Options.Any(o => string.IsNullOrWhiteSpace(o.Id) || string.IsNullOrWhiteSpace(o.Text))) return "option_empty";
        if (i.Options.Select(o => o.Id).Distinct().Count() != i.Options.Count) return "option_ids_must_be_unique";
        if (string.IsNullOrEmpty(i.CorrectOptionId) || !i.Options.Any(o => o.Id == i.CorrectOptionId)) return "correct_option_invalid";
        return null;
    }

    internal static string? MatchCorrect(string answer, string a, string b, string c, string d)
    {
        var key = answer.Trim().ToUpperInvariant();
        switch (key)
        {
            case "A": case "1": return "a";
            case "B": case "2": return "b";
            case "C": case "3": return "c";
            case "D": case "4": return "d";
        }
        var text = answer.Trim().ToLowerInvariant();
        var opts = new[] { a, b, c, d };
        for (var i = 0; i < 4; i++)
            if (opts[i] != "" && opts[i].ToLowerInvariant() == text) return "abcd"[i].ToString();
        return null; // unlike the old local importer, never guess "a"
    }

    internal record Target(Subcategory? Subcategory, Subject? Subject, string? Error);

    // Finds category > subcategory > subject by name. With create=true, missing ones are created.
    internal static async Task<Target> Resolve(AppDbContext db, string category, string subcategory, string? subject, bool create)
    {
        category = category.Trim();
        subcategory = subcategory.Trim();
        var subjectName = string.IsNullOrWhiteSpace(subject) || subject.Trim().ToLowerInvariant() == "none" ? null : subject.Trim();

        var cat = await db.Categories.FirstOrDefaultAsync(c => c.Name == category);
        if (cat == null)
        {
            if (!create) return new Target(null, null, "category_not_found");
            cat = new Category { Name = category };
            db.Categories.Add(cat);
            await db.SaveChangesAsync();
        }

        var sub = await db.Subcategories.FirstOrDefaultAsync(s => s.CategoryId == cat.Id && s.Name == subcategory);
        if (sub == null)
        {
            if (!create) return new Target(null, null, "subcategory_not_found");
            sub = new Subcategory { CategoryId = cat.Id, Name = subcategory };
            db.Subcategories.Add(sub);
            await db.SaveChangesAsync();
        }

        Subject? subj = null;
        if (subjectName != null)
        {
            subj = await db.Subjects.FirstOrDefaultAsync(s => s.SubcategoryId == sub.Id && s.Name == subjectName);
            if (subj == null)
            {
                if (!create) return new Target(null, null, "subject_not_found");
                subj = new Subject { SubcategoryId = sub.Id, Name = subjectName };
                db.Subjects.Add(subj);
                await db.SaveChangesAsync();
            }
        }
        return new Target(sub, subj, null);
    }
}
