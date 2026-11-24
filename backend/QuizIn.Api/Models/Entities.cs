namespace QuizIn.Api.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";          // stored lower-case, unique
    public string PasswordHash { get; set; } = "";   // BCrypt
    public bool IsAdmin { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

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

public class Subcategory
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public string Name { get; set; } = "";
    public List<Subject> Subjects { get; set; } = new();
}

public class Subject
{
    public int Id { get; set; }
    public int SubcategoryId { get; set; }
    public Subcategory? Subcategory { get; set; }
    public string Name { get; set; } = "";
    public int? TimerMinutes { get; set; }           // overrides the category timer when set
    public string? ImageUrl { get; set; }
}

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

// Key / value settings (the game rules are one JSON value under the key "game").
public class AppSetting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}

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

public class DailyStreak
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public DateOnly? LastDate { get; set; }
    public int Streak { get; set; }
    public int Best { get; set; }
    public string? LastScore { get; set; }
}

public class UserStats
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int Answered { get; set; }
    public int Correct { get; set; }
}

public class Bookmark
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int QuestionId { get; set; }
    public Question? Question { get; set; }
}

public class Mistake
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int QuestionId { get; set; }
    public Question? Question { get; set; }
}
