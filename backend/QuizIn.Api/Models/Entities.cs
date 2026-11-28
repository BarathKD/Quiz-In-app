// Entities.cs - the database tables. Each class here = one table (EF Core makes the tables from these classes).
// Table rules (indexes, foreign keys, cascade delete) are set in Data/AppDbContext.cs, not here.
// Dev database: SQLite file quizin.db. After adding or changing a class here, delete quizin.db* and run again.
namespace QuizIn.Api.Models;

/// <summary>A player or admin account. Created by POST /api/auth/register (Auth/AuthEndpoints.cs). Deleting a user deletes all their progress (cascade).</summary>
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";          // stored lower-case, unique
    public string PasswordHash { get; set; } = "";   // BCrypt
    public bool IsAdmin { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Top level of the content tree: Category > Subcategory > Subject > Questions. Example: "TNPSC". The app shows these on the home screen.</summary>
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int TimerMinutes { get; set; } = 5;
    public double BackgroundOpacity { get; set; } = 0.85;
    public int SortOrder { get; set; }
    public string? ImageUrl { get; set; }            // "/uploads/xxxx.jpg"
    public List<Subcategory> Subcategories { get; set; } = new();
}

/// <summary>Second level, for example "Class 10" inside a category. Deleting it deletes its subjects and questions.</summary>
public class Subcategory
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public string Name { get; set; } = "";
    public List<Subject> Subjects { get; set; } = new();
}

/// <summary>Third level (optional), for example "History". Questions may belong to a subject or directly to the subcategory (SubjectId = null).</summary>
public class Subject
{
    public int Id { get; set; }
    public int SubcategoryId { get; set; }
    public Subcategory? Subcategory { get; set; }
    public string Name { get; set; } = "";
    public int? TimerMinutes { get; set; }           // overrides the category timer when set
    public string? ImageUrl { get; set; }
}

/// <summary>One multiple choice question. Options are stored as JSON text in OptionsJson; CorrectOptionId says which option id is right.</summary>
public class Question
{
    public int Id { get; set; }
    public int SubcategoryId { get; set; }
    public Subcategory? Subcategory { get; set; }
    public int? SubjectId { get; set; }
    public Subject? Subject { get; set; }
    public string Difficulty { get; set; } = "easy"; // easy | medium | hard
    public string QuestionText { get; set; } = "";
    public string OptionsJson { get; set; } = "[]";  // [{"id":"a","text":"..."}]
    public string CorrectOptionId { get; set; } = "";
    public string? Explanation { get; set; }
    public int? ImportBatchId { get; set; }          // set when the question came from a bulk import (for undo)
}

// Table PasswordResets. Created by POST /api/auth/forgot, used by POST /api/auth/reset (Auth/AuthEndpoints.cs).
// Attempts counts wrong codes; after 5 the code stops working. Used = true once the password was changed.
// A "forgot password" code e-mailed to the player. Only a hash of the 6-digit code is stored.
public class PasswordReset
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string CodeHash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public bool Used { get; set; }
}

// Table ExamResults. Written by POST /api/me/exams (Auth/UserDataEndpoints.cs) after the server has graded the test.
// Rank = position by best Percent among all players with the same SubcategoryId + SubjectId.
// One finished mock test. Scope = the subcategory (+ subject when the test was for a subject).
public class ExamResult
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int SubcategoryId { get; set; }
    public Subcategory? Subcategory { get; set; }
    public int? SubjectId { get; set; }              // plain column: no foreign key, so deleting a subject never conflicts
    public int Total { get; set; }
    public int Correct { get; set; }
    public int Wrong { get; set; }
    public double Score { get; set; }
    public int Percent { get; set; }
    public int Seconds { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Table QuestionReports. Created from the app (POST /api/me/reports); the admin sees them on the Reports page.
// A player's report that a question is wrong, has a typo or is unclear.
public class QuestionReport
{
    public int Id { get; set; }
    public int QuestionId { get; set; }
    public Question? Question { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Reason { get; set; } = "other";   // wrong_answer | typo | unclear | other
    public string? Note { get; set; }
    public string Status { get; set; } = "open";    // open | fixed | dismissed
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}

// Table AppSettings. Edited on Admin > Settings; read by the app through GET /api/settings (Content/GameSettings.cs).
// Key / value settings (the game rules are one JSON value under the key "game").
public class AppSetting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}

// Table ImportBatches. Every imported question stores its ImportBatchId, so "Undo" can remove exactly that import (Admin/ImportService.cs).
// One admin bulk import; lets the admin see history and undo it.
public class ImportBatch
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string FileName { get; set; } = "";
    public string AdminEmail { get; set; } = "";
    public int Added { get; set; }
    public int Updated { get; set; }
    public bool Undone { get; set; }
}

// Table LevelProgresses. A level is "passed" per user + subcategory + subject + difficulty + level number. Drives progress and the leaderboard.
// One row per level a user has passed
public class LevelProgress
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int SubcategoryId { get; set; }
    public int? SubjectId { get; set; }
    public string Difficulty { get; set; } = "easy";
    public int LevelNumber { get; set; }
    public DateTime PassedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>One row per user: Daily Challenge streak (days in a row), best streak and the last date played.</summary>
public class DailyStreak
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public DateOnly? LastDate { get; set; }
    public int Streak { get; set; }
    public int Best { get; set; }
    public string? LastScore { get; set; }
}

/// <summary>One row per user: total answers and correct answers (used for accuracy and achievements).</summary>
public class UserStats
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int Answered { get; set; }
    public int Correct { get; set; }
}

/// <summary>A question the user saved to practise later. One row per user + question.</summary>
public class Bookmark
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int QuestionId { get; set; }
    public Question? Question { get; set; }
}

/// <summary>A question the user answered wrong. It stays in My Mistakes until answered correctly. One row per user + question.</summary>
public class Mistake
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int QuestionId { get; set; }
    public Question? Question { get; set; }
}
