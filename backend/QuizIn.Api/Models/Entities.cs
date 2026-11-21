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
