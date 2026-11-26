using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Content;

// Game rules the admin can change from the web without releasing a new app version.
// Served to the app at GET /api/settings; stored as one JSON row in AppSettings.
public class GameSettings
{
    // Levels
    public int QuestionsPerLevel { get; set; } = 50;

    // Practice: percent of answers that must be correct to pass a level
    public int PassMarkEasy { get; set; } = 70;
    public int PassMarkMedium { get; set; } = 80;
    public int PassMarkHard { get; set; } = 90;

    // Challenge: rounds of questions, one mistake ends it (unless revived)
    public bool ChallengeEnabled { get; set; } = true;
    public int ChallengeQuestionsPerRound { get; set; } = 10;
    public int ChallengeRounds { get; set; } = 3;
    public int ChallengeSecondsEasy { get; set; } = 15;
    public int ChallengeSecondsMedium { get; set; } = 15;
    public int ChallengeSecondsHard { get; set; } = 15;
    public int ChallengeRevives { get; set; } = 1;
    public int ChallengeBonusMultiplier { get; set; } = 2;

    // App updates: versions older than this must update before playing (e.g. "1.2.0")
    public string MinAppVersion { get; set; } = "1.0.0";

    // Daily challenge
    public int DailyQuestionCount { get; set; } = 10;
    public int DailyTimerMinutes { get; set; } = 10;

    // Exam mode (mock test): mixed-difficulty questions, one timer, negative marking, score + rank
    public bool ExamEnabled { get; set; } = true;
    public int ExamQuestionCount { get; set; } = 25;
    public int ExamMinutes { get; set; } = 30;
    public int ExamNegativePercent { get; set; } = 25; // part of one mark lost per wrong answer (25 = a quarter mark, 0 = off)
    public int ExamPassMark { get; set; } = 40;        // percent of the marks needed to pass

    // Daily reminder notification: the admin decides whether it is sent, when, and what it says.
    public bool ReminderEnabled { get; set; } = true;
    public int ReminderHour { get; set; } = 20;
    public int ReminderMinute { get; set; } = 0;
    public string ReminderTitleTa { get; set; } = "Quiz-IN வினாடி வினா";
    public string ReminderTitleEn { get; set; } = "Quiz-IN";
    public string ReminderBodyTa { get; set; } = "இன்றைய தினசரி சவாலை முடித்து உங்கள் streak-ஐ காப்பாற்றுங்கள்!";
    public string ReminderBodyEn { get; set; } = "Finish today's daily challenge and keep your streak alive!";

    private static string Text(string? value, string fallback, int max)
    {
        var v = (value ?? "").Trim();
        if (v.Length == 0) return fallback;
        return v.Length > max ? v[..max] : v;
    }

    // Keeps every value inside a sensible range so a typo cannot break the app.
    public GameSettings Normalize()
    {
        QuestionsPerLevel = Math.Clamp(QuestionsPerLevel, 5, 200);
        PassMarkEasy = Math.Clamp(PassMarkEasy, 1, 100);
        PassMarkMedium = Math.Clamp(PassMarkMedium, 1, 100);
        PassMarkHard = Math.Clamp(PassMarkHard, 1, 100);
        ChallengeQuestionsPerRound = Math.Clamp(ChallengeQuestionsPerRound, 3, 50);
        ChallengeRounds = Math.Clamp(ChallengeRounds, 1, 10);
        ChallengeSecondsEasy = Math.Clamp(ChallengeSecondsEasy, 5, 120);
        ChallengeSecondsMedium = Math.Clamp(ChallengeSecondsMedium, 5, 120);
        ChallengeSecondsHard = Math.Clamp(ChallengeSecondsHard, 5, 120);
        ChallengeRevives = Math.Clamp(ChallengeRevives, 0, 5);
        ChallengeBonusMultiplier = Math.Clamp(ChallengeBonusMultiplier, 1, 10);
        DailyQuestionCount = Math.Clamp(DailyQuestionCount, 3, 50);
        DailyTimerMinutes = Math.Clamp(DailyTimerMinutes, 1, 60);
        ExamQuestionCount = Math.Clamp(ExamQuestionCount, 5, 200);
        ExamMinutes = Math.Clamp(ExamMinutes, 1, 240);
        ExamNegativePercent = Math.Clamp(ExamNegativePercent, 0, 100);
        ExamPassMark = Math.Clamp(ExamPassMark, 1, 100);
        var defaults = new GameSettings();
        ReminderHour = Math.Clamp(ReminderHour, 0, 23);
        ReminderMinute = Math.Clamp(ReminderMinute, 0, 59);
        ReminderTitleTa = Text(ReminderTitleTa, defaults.ReminderTitleTa, 60);
        ReminderTitleEn = Text(ReminderTitleEn, defaults.ReminderTitleEn, 60);
        ReminderBodyTa = Text(ReminderBodyTa, defaults.ReminderBodyTa, 160);
        ReminderBodyEn = Text(ReminderBodyEn, defaults.ReminderBodyEn, 160);
        MinAppVersion = System.Text.RegularExpressions.Regex.IsMatch(MinAppVersion ?? "", @"^\d{1,4}(\.\d{1,4}){0,2}$")
            ? MinAppVersion!.Trim() : "1.0.0";
        return this;
    }
}

public static class GameSettingsStore
{
    private const string Key = "game";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<GameSettings> LoadAsync(AppDbContext db)
    {
        var row = await db.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == Key);
        if (row == null) return new GameSettings();
        try { return (JsonSerializer.Deserialize<GameSettings>(row.Value, Json) ?? new GameSettings()).Normalize(); }
        catch (JsonException) { return new GameSettings(); }
    }

    public static async Task SaveAsync(AppDbContext db, GameSettings settings)
    {
        var json = JsonSerializer.Serialize(settings.Normalize(), Json);
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == Key);
        if (row == null) db.AppSettings.Add(new AppSetting { Key = Key, Value = json });
        else row.Value = json;
        await db.SaveChangesAsync();
    }

    public static void MapSettings(this IEndpointRouteBuilder app)
    {
        // Not secret, and the app loads it on start-up before anyone logs in.
        app.MapGet("/api/settings", async (AppDbContext db) => Results.Ok(await LoadAsync(db))).AllowAnonymous();
    }
}
