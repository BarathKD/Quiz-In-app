using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Models;

namespace QuizIn.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

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

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<User>().Property(u => u.Email).HasMaxLength(256);

        b.Entity<Category>().Property(c => c.Name).HasMaxLength(200);
        b.Entity<Category>().HasIndex(c => c.Name).IsUnique();
        b.Entity<Subcategory>().Property(s => s.Name).HasMaxLength(200);
        b.Entity<Subcategory>().HasIndex(s => new { s.CategoryId, s.Name }).IsUnique();
        b.Entity<Subject>().Property(s => s.Name).HasMaxLength(200);
        b.Entity<Subject>().HasIndex(s => new { s.SubcategoryId, s.Name }).IsUnique();

        // SQL Server forbids several cascade paths to one table, so the optional
        // Subject links use NoAction (checked at end of statement, so cascades from Subcategory still work). Subcategory -> Question/Subject still cascades.
        b.Entity<Question>()
            .HasOne(q => q.Subject).WithMany().HasForeignKey(q => q.SubjectId)
            .OnDelete(DeleteBehavior.NoAction);
        b.Entity<Question>().HasIndex(q => new { q.SubcategoryId, q.SubjectId, q.Difficulty });

        b.Entity<LevelProgress>()
            .HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<LevelProgress>()
            .HasOne<Subcategory>().WithMany().HasForeignKey(p => p.SubcategoryId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<LevelProgress>()
            .HasOne<Subject>().WithMany().HasForeignKey(p => p.SubjectId).OnDelete(DeleteBehavior.NoAction);
        b.Entity<LevelProgress>()
            .HasIndex(p => new { p.UserId, p.SubcategoryId, p.SubjectId, p.Difficulty, p.LevelNumber });

        b.Entity<Question>().HasIndex(q => q.ImportBatchId);

        b.Entity<DailyStreak>().HasKey(d => d.UserId);
        b.Entity<DailyStreak>().HasOne(d => d.User).WithMany().HasForeignKey(d => d.UserId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<UserStats>().HasKey(s => s.UserId);
        b.Entity<UserStats>().HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<Bookmark>().HasKey(x => new { x.UserId, x.QuestionId });
        b.Entity<Bookmark>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Bookmark>().HasOne(x => x.Question).WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<Mistake>().HasKey(x => new { x.UserId, x.QuestionId });
        b.Entity<Mistake>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Mistake>().HasOne(x => x.Question).WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade);
    }
}
