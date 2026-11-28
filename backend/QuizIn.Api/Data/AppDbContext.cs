using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Models;

namespace QuizIn.Api.Data;

/// <summary>
/// The database session used everywhere (injected as AppDbContext). Each DbSet below is one table.
/// The database is SQLite in development and SQL Server in production (chosen in Program.cs).
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // --- Tables (one DbSet per entity class in Models/Entities.cs) ---
    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Subcategory> Subcategories => Set<Subcategory>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<LevelProgress> LevelProgress => Set<LevelProgress>();
    public DbSet<DailyStreak> DailyStreaks => Set<DailyStreak>();
    public DbSet<UserStats> UserStats => Set<UserStats>();
    public DbSet<Bookmark> Bookmarks => Set<Bookmark>();
    public DbSet<Mistake> Mistakes => Set<Mistake>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<QuestionReport> QuestionReports => Set<QuestionReport>();
    public DbSet<PasswordReset> PasswordResets => Set<PasswordReset>();
    public DbSet<ExamResult> ExamResults => Set<ExamResult>();
    public DbSet<ChallengeWin> ChallengeWins => Set<ChallengeWin>();

    // Table rules: unique indexes, max lengths, keys and what happens to child rows when a parent is deleted.
    protected override void OnModelCreating(ModelBuilder b)
    {
        // Users: one account per e-mail (e-mail is saved in lower case).
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<User>().Property(u => u.Email).HasMaxLength(256);

        // Content tree: names are unique inside their parent (two categories cannot share a name; the same subject name can be in different subcategories).
        b.Entity<Category>().Property(c => c.Name).HasMaxLength(200);
        b.Entity<Category>().HasIndex(c => c.Name).IsUnique();
        b.Entity<Subcategory>().Property(s => s.Name).HasMaxLength(200);
        b.Entity<Subcategory>().HasIndex(s => new { s.CategoryId, s.Name }).IsUnique();
        b.Entity<Subject>().Property(s => s.Name).HasMaxLength(200);
        b.Entity<Subject>().HasIndex(s => new { s.SubcategoryId, s.Name }).IsUnique();

        // Questions: Subject link is optional and uses NoAction on delete (see the note below); the index speeds up loading questions by scope + difficulty.
        // SQL Server forbids several cascade paths to one table, so the optional
        // Subject links use NoAction (checked at end of statement, so cascades from Subcategory still work). Subcategory -> Question/Subject still cascades.
        b.Entity<Question>()
            .HasOne(q => q.Subject).WithMany().HasForeignKey(q => q.SubjectId)
            .OnDelete(DeleteBehavior.NoAction);
        b.Entity<Question>().HasIndex(q => new { q.SubcategoryId, q.SubjectId, q.Difficulty });

        // Level progress: deleting a user or subcategory removes their progress rows; the subject link uses NoAction (SQL Server cascade rule).
        // The index makes "which levels has this user passed" fast.
        b.Entity<LevelProgress>()
            .HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<LevelProgress>()
            .HasOne<Subcategory>().WithMany().HasForeignKey(p => p.SubcategoryId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<LevelProgress>()
            .HasOne<Subject>().WithMany().HasForeignKey(p => p.SubjectId).OnDelete(DeleteBehavior.NoAction);
        b.Entity<LevelProgress>()
            .HasIndex(p => new { p.UserId, p.SubcategoryId, p.SubjectId, p.Difficulty, p.LevelNumber });

        // Import undo: find all questions of one import batch quickly.
        b.Entity<Question>().HasIndex(q => q.ImportBatchId);
        // Reports: removed together with the user or the question; Note is limited to 500 characters; index helps the admin Reports page group by status + question.
        b.Entity<QuestionReport>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<QuestionReport>().HasOne(x => x.Question).WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<QuestionReport>().HasIndex(x => new { x.Status, x.QuestionId });
        b.Entity<QuestionReport>().Property(x => x.Note).HasMaxLength(500);
        // Exam results: cascade from user and subcategory. SubjectId has NO foreign key on purpose (SQL Server multiple cascade path rule). The index is used to calculate the rank.
        b.Entity<ExamResult>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ExamResult>().HasOne(x => x.Subcategory).WithMany().HasForeignKey(x => x.SubcategoryId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ExamResult>().HasIndex(x => new { x.SubcategoryId, x.SubjectId });
        // Challenge wins: removed with the user or the subcategory; one row per user + scope + difficulty (unique), so a win is an upsert.
        b.Entity<ChallengeWin>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ChallengeWin>().HasOne(x => x.Subcategory).WithMany().HasForeignKey(x => x.SubcategoryId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ChallengeWin>().HasIndex(x => new { x.UserId, x.SubcategoryId, x.SubjectId, x.Difficulty }).IsUnique();
        // Password reset codes: removed with the user; index finds a user's unused codes.
        b.Entity<PasswordReset>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<PasswordReset>().HasIndex(x => new { x.UserId, x.Used });
        // Settings: the Key (for example "game") is the primary key.
        b.Entity<AppSetting>().HasKey(s => s.Key);
        b.Entity<AppSetting>().Property(s => s.Key).HasMaxLength(64);

        // One row per user (the user id is the key) for streak and stats; deleted with the user.
        b.Entity<DailyStreak>().HasKey(d => d.UserId);
        b.Entity<DailyStreak>().HasOne(d => d.User).WithMany().HasForeignKey(d => d.UserId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<UserStats>().HasKey(s => s.UserId);
        b.Entity<UserStats>().HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);

        // Bookmarks and mistakes: the pair (user, question) is the key, so a question can be saved only once per user; deleted with the user or the question.
        b.Entity<Bookmark>().HasKey(x => new { x.UserId, x.QuestionId });
        b.Entity<Bookmark>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Bookmark>().HasOne(x => x.Question).WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<Mistake>().HasKey(x => new { x.UserId, x.QuestionId });
        b.Entity<Mistake>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Mistake>().HasOne(x => x.Question).WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade);
    }
}
