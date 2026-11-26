using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Content;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Auth;

public record LevelPassedInput(string? Category, string? Subcategory, string? Subject, string? Difficulty, int LevelNumber);
public record AnswerInput(int QuestionId, bool Correct, bool CountStats = true);
public record ReportInput(int QuestionId, string? Reason, string? Note);
public record DailyInput(string? Date, int Score, int Total);
public record ExamAnswer(int QuestionId, string? OptionId);
public record ExamInput(List<ExamAnswer>? Answers, int Seconds);
public record PassedLevelDto(string Category, string Subcategory, string? Subject, string Difficulty, int LevelNumber);
public record LeaderboardRow(int Rank, Guid Id, string Name, int Levels, int Points);

// Per-user data for the app: level progress, mistakes, bookmarks, stats, daily streak, leaderboard.
public static class UserDataEndpoints
{
    private static readonly string[] Difficulties = { "easy", "medium", "hard" };
    private const int QuestionsPerLevel = 50;
    private static readonly string[] ReportReasons = { "wrong_answer", "typo", "unclear", "other" };

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

        // Mock test result. The server grades it itself from the stored correct options (the phone cannot cheat),
        // saves it, and answers with the score and the player's rank among everyone who took the same test.
        g.MapPost("/exams", async (ExamInput input, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            var settings = await GameSettingsStore.LoadAsync(db);
            if (!settings.ExamEnabled) return Results.BadRequest(new { error = "exam_disabled" });

            var answers = (input.Answers ?? new()).GroupBy(a => a.QuestionId).Select(x => x.First()).ToList();
            if (answers.Count == 0 || answers.Count > settings.ExamQuestionCount) return Results.BadRequest(new { error = "invalid_exam" });

            var ids = answers.Select(a => a.QuestionId).ToList();
            var questions = await db.Questions.AsNoTracking().Where(q => ids.Contains(q.Id))
                .Select(q => new { q.Id, q.SubcategoryId, q.SubjectId, q.CorrectOptionId }).ToListAsync();
            if (questions.Count != ids.Count) return Results.BadRequest(new { error = "invalid_exam" });

            // A test is for one subcategory (and subject)
            var subcategoryId = questions[0].SubcategoryId;
            var subjectId = questions[0].SubjectId;
            if (questions.Any(q => q.SubcategoryId != subcategoryId || q.SubjectId != subjectId))
                return Results.BadRequest(new { error = "invalid_exam" });

            var correctById = questions.ToDictionary(q => q.Id, q => q.CorrectOptionId);
            var correct = answers.Count(a => !string.IsNullOrEmpty(a.OptionId) && a.OptionId == correctById[a.QuestionId]);
            var wrong = answers.Count(a => !string.IsNullOrEmpty(a.OptionId) && a.OptionId != correctById[a.QuestionId]);
            var total = answers.Count;
            var score = Math.Max(0, Math.Round(correct - wrong * settings.ExamNegativePercent / 100.0, 2));
            var percent = (int)Math.Round(score * 100.0 / total);

            db.ExamResults.Add(new ExamResult
            {
                UserId = uid, SubcategoryId = subcategoryId, SubjectId = subjectId,
                Total = total, Correct = correct, Wrong = wrong, Score = score, Percent = percent,
                Seconds = Math.Clamp(input.Seconds, 0, settings.ExamMinutes * 60 + 60),
            });
            await db.SaveChangesAsync();

            // Rank: everyone's best percent in this same test scope
            var best = await db.ExamResults.AsNoTracking()
                .Where(r => r.SubcategoryId == subcategoryId && r.SubjectId == subjectId)
                .GroupBy(r => r.UserId).Select(x => new { UserId = x.Key, Best = x.Max(r => r.Percent) }).ToListAsync();
            var mine = best.First(b => b.UserId == uid).Best;
            return Results.Ok(new
            {
                total, correct, wrong, unanswered = total - correct - wrong, score, percent,
                passed = percent >= settings.ExamPassMark,
                rank = 1 + best.Count(b => b.Best > mine),
                participants = best.Count,
            });
        });

        // "Report this question": wrong answer, typo, unclear. The admin sees these under Reports.
        g.MapPost("/reports", async (ReportInput input, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            var reason = (input.Reason ?? "").ToLowerInvariant();
            if (!ReportReasons.Contains(reason)) return Results.BadRequest(new { error = "invalid_reason" });
            if (!await db.Questions.AnyAsync(q => q.Id == input.QuestionId)) return Results.NotFound(new { error = "question_not_found" });

            // Reporting the same question twice does nothing; a daily cap stops spam.
            if (await db.QuestionReports.AnyAsync(r => r.UserId == uid && r.QuestionId == input.QuestionId && r.Status == "open"))
                return Results.NoContent();
            var since = DateTime.UtcNow.AddHours(-24);
            if (await db.QuestionReports.CountAsync(r => r.UserId == uid && r.CreatedAt > since) >= 30)
                return Results.StatusCode(StatusCodes.Status429TooManyRequests);

            var note = input.Note?.Trim();
            if (note != null && note.Length > 500) note = note[..500];
            db.QuestionReports.Add(new QuestionReport
            {
                QuestionId = input.QuestionId, UserId = uid, Reason = reason,
                Note = string.IsNullOrEmpty(note) ? null : note,
            });
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

        // Idempotent "add bookmark" (the offline queue replays this safely).
        g.MapPut("/bookmarks/{questionId:int}", async (int questionId, ClaimsPrincipal p, AppDbContext db) =>
        {
            if (AuthEndpoints.UserId(p) is not Guid uid) return Results.Unauthorized();
            if (await db.Bookmarks.FindAsync(uid, questionId) != null) return Results.NoContent();
            if (!await db.Questions.AnyAsync(q => q.Id == questionId)) return Results.NotFound(new { error = "question_not_found" });
            db.Bookmarks.Add(new Bookmark { UserId = uid, QuestionId = questionId });
            await db.SaveChangesAsync();
            return Results.NoContent();
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
            var dailyCount = (await GameSettingsStore.LoadAsync(db)).DailyQuestionCount;
            var ids = await db.Questions.AsNoTracking().OrderBy(q => q.Id).Select(q => q.Id).ToListAsync();
            var rand = new Random(day.DayNumber);
            for (var i = ids.Count - 1; i > 0; i--)
            {
                var j = rand.Next(i + 1);
                (ids[i], ids[j]) = (ids[j], ids[i]);
            }
            var pick = ids.Take(dailyCount).ToList();
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
