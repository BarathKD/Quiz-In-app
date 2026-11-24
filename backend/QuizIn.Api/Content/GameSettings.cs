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
