using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Content;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Auth;

public record LevelPassedInput(string? Category, string? Subcategory, string? Subject, string? Difficulty, int LevelNumber);
public record AnswerInput(int QuestionId, bool Correct, bool CountStats = true);
public record DailyInput(string? Date, int Score, int Total);
public record PassedLevelDto(string Category, string Subcategory, string? Subject, string Difficulty, int LevelNumber);
public record LeaderboardRow(int Rank, Guid Id, string Name, int Levels, int Points);

// Per-user data for the app: level progress, mistakes, bookmarks, stats, daily streak, leaderboard.
public static class UserDataEndpoints
{
    private static readonly string[] Difficulties = { "easy", "medium", "hard" };
    private const int QuestionsPerLevel = 50;
    private const int DailyCount = 10;

    private static int Weight(string difficulty) => difficulty == "hard" ? 3 : difficulty == "medium" ? 2 : 1;

    public static void MapUserData(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/me").RequireAuthorization();

        // Everything the app needs after login, in one call.
        g.MapGet("/data", async (ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();

            var passed = await db.LevelProgress.AsNoTracking().Where(x => x.UserId == uid)
                .Join(db.Subcategories, x => x.SubcategoryId, s => s.Id, (x, s) => new { x, s })
                .Select(r => new PassedLevelDto(
                    r.s.Category!.Name, r.s.Name,
                    r.x.SubjectId == null ? null : db.Subjects.Where(j => j.Id == r.x.SubjectId).Select(j => j.Name).FirstOrDefault(),
                    r.x.Difficulty, r.x.LevelNumber))
                .ToListAsync();

            var mistakes = await db.Mistakes.AsNoTracking().Where(x => x.UserId == uid).Select(x => x.QuestionId).ToListAsync();
            var bookmarks = await db.Bookmarks.AsNoTracking().Where(x => x.UserId == uid).Select(x => x.QuestionId).ToListAsync();
            var stats = await db.UserStats.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == uid);
            var daily = await db.DailyStreaks.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == uid);

            return Results.Ok(new
            {
                levels = passed,
                mistakes,
                bookmarks,
                stats = new { answered = stats?.Answered ?? 0, correct = stats?.Correct ?? 0 },
                daily = new
                {
                    lastDate = daily?.LastDate?.ToString("yyyy-MM-dd"),
                    streak = daily?.Streak ?? 0,
                    best = daily?.Best ?? 0,
                    lastScore = daily?.LastScore,
                },
            });
        });

        g.MapPost("/levels", async (LevelPassedInput input, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            var difficulty = (input.Difficulty ?? "").ToLowerInvariant();
            if (!Difficulties.Contains(difficulty) || input.LevelNumber < 1 || input.LevelNumber > 1000)
                return Results.BadRequest(new { error = "invalid_level" });

            var sub = await db.Subcategories.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Name == input.Subcategory && s.Category!.Name == input.Category);
            if (sub == null) return Results.NotFound(new { error = "subcategory_not_found" });

            int? subjectId = null;
            if (!string.IsNullOrEmpty(input.Subject))
            {
                subjectId = await db.Subjects.Where(s => s.SubcategoryId == sub.Id && s.Name == input.Subject)
                    .Select(s => (int?)s.Id).FirstOrDefaultAsync();
                if (subjectId == null) return Results.NotFound(new { error = "subject_not_found" });
            }

            var exists = await db.LevelProgress.AnyAsync(x => x.UserId == uid && x.SubcategoryId == sub.Id
                && x.SubjectId == subjectId && x.Difficulty == difficulty && x.LevelNumber == input.LevelNumber);
            if (!exists)
            {
                db.LevelProgress.Add(new LevelProgress
                {
                    UserId = uid, SubcategoryId = sub.Id, SubjectId = subjectId,
                    Difficulty = difficulty, LevelNumber = input.LevelNumber,
                });
                await db.SaveChangesAsync();
            }
            return Results.NoContent();
        });

        // Records one answer: keeps the mistakes list and (optionally) the answered/correct counters.
        g.MapPost("/answers", async (AnswerInput input, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            if (!await db.Questions.AnyAsync(q => q.Id == input.QuestionId)) return Results.NotFound(new { error = "question_not_found" });

            var mistake = await db.Mistakes.FindAsync(uid, input.QuestionId);
            if (!input.Correct && mistake == null) db.Mistakes.Add(new Mistake { UserId = uid, QuestionId = input.QuestionId });
            else if (input.Correct && mistake != null) db.Mistakes.Remove(mistake);

            if (input.CountStats)
            {
                var stats = await db.UserStats.FindAsync(uid);
                if (stats == null) { stats = new UserStats { UserId = uid }; db.UserStats.Add(stats); }
                stats.Answered += 1;
                if (input.Correct) stats.Correct += 1;
            }
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        g.MapDelete("/mistakes/{questionId:int}", async (int questionId, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            var m = await db.Mistakes.FindAsync(uid, questionId);
            if (m != null) { db.Mistakes.Remove(m); await db.SaveChangesAsync(); }
            return Results.NoContent();
        });

        // Toggles a bookmark and returns the new state.
        g.MapPost("/bookmarks/{questionId:int}", async (int questionId, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            var b = await db.Bookmarks.FindAsync(uid, questionId);
            if (b != null) { db.Bookmarks.Remove(b); await db.SaveChangesAsync(); return Results.Ok(new { bookmarked = false }); }
            if (!await db.Questions.AnyAsync(q => q.Id == questionId)) return Results.NotFound(new { error = "question_not_found" });
            db.Bookmarks.Add(new Bookmark { UserId = uid, QuestionId = questionId });
            await db.SaveChangesAsync();
            return Results.Ok(new { bookmarked = true });
        });

        g.MapDelete("/bookmarks/{questionId:int}", async (int questionId, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            var b = await db.Bookmarks.FindAsync(uid, questionId);
            if (b != null) { db.Bookmarks.Remove(b); await db.SaveChangesAsync(); }
            return Results.NoContent();
        });

        // The same 10 questions for everyone on a given day. ?date=yyyy-MM-dd (the user's local date).
        app.MapGet("/api/daily", async (string? date, AppDbContext db) =>
        {
            if (!TryDate(date, out var day)) return Results.BadRequest(new { error = "invalid_date" });
            var ids = await db.Questions.AsNoTracking().OrderBy(q => q.Id).Select(q => q.Id).ToListAsync();
            var rand = new Random(day.DayNumber);
            for (var i = ids.Count - 1; i > 0; i--)
            {
                var j = rand.Next(i + 1);
                (ids[i], ids[j]) = (ids[j], ids[i]);
            }
            var pick = ids.Take(DailyCount).ToList();
            var rows = await ContentEndpoints.QuestionQuery(db).Where(q => pick.Contains(q.Id)).ToListAsync();
            var order = pick.Select((id, idx) => (id, idx)).ToDictionary(x => x.id, x => x.idx);
            return Results.Ok(rows.OrderBy(q => order[q.Id]).Select(ContentEndpoints.ToDto));
        }).RequireAuthorization();

        g.MapPost("/daily", async (DailyInput input, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            if (!TryDate(input.Date, out var today)) return Results.BadRequest(new { error = "invalid_date" });

            var d = await db.DailyStreaks.FindAsync(uid);
            if (d == null) { d = new DailyStreak { UserId = uid }; db.DailyStreaks.Add(d); }
            if (d.LastDate != today)
            {
                d.Streak = d.LastDate == today.AddDays(-1) ? d.Streak + 1 : 1;
                d.Best = Math.Max(d.Best, d.Streak);
                d.LastDate = today;
                d.LastScore = $"{input.Score}/{input.Total}";
                await db.SaveChangesAsync();
            }
            return Results.Ok(new { streak = d.Streak, best = d.Best, doneToday = true, lastScore = d.LastScore });
        });

        // Points: passed level = 50 questions x difficulty weight (easy 1, medium 2, hard 3). Admins are excluded.
        app.MapGet("/api/leaderboard", async (AppDbContext db) =>
        {
            var counts = await db.LevelProgress.AsNoTracking()
                .Where(x => !x.User!.IsAdmin)
                .GroupBy(x => new { x.UserId, x.Difficulty })
                .Select(gp => new { gp.Key.UserId, gp.Key.Difficulty, N = gp.Count() })
                .ToListAsync();
            var users = await db.Users.AsNoTracking().Where(u => !u.IsAdmin)
                .Select(u => new { u.Id, u.Email }).ToListAsync();

            var rows = users.Select(u =>
            {
                var mine = counts.Where(c => c.UserId == u.Id).ToList();
                var levels = mine.Sum(c => c.N);
                var points = mine.Sum(c => c.N * QuestionsPerLevel * Weight(c.Difficulty));
                var name = u.Email.Split('@')[0];
                return (u.Id, name, levels, points);
            })
            .OrderByDescending(r => r.points).ThenBy(r => r.name, StringComparer.OrdinalIgnoreCase)
            .Take(100).ToList();

            return Results.Ok(rows.Select((r, i) => new LeaderboardRow(i + 1, r.Id, r.name, r.levels, r.points)));
        }).RequireAuthorization();
    }

    // Accepts the user's local date, but not one far from the server's UTC date (stops streak cheating).
    private static bool TryDate(string? text, out DateOnly day)
    {
        day = default;
        if (!DateOnly.TryParseExact(text ?? DateTime.UtcNow.ToString("yyyy-MM-dd"), "yyyy-MM-dd", out day)) return false;
        var diff = Math.Abs(day.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber);
        return diff <= 1;
    }
}
