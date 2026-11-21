using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Content;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Admin;

// ---------------- Dashboard ----------------
[Route("admin")]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminDashboardController : Controller
{
    private readonly AppDbContext _db;
    public AdminDashboardController(AppDbContext db) => _db = db;

    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var vm = new DashboardVm
        {
            Users = await _db.Users.CountAsync(u => !u.IsAdmin),
            Categories = await _db.Categories.CountAsync(),
            Questions = await _db.Questions.CountAsync(),
            LevelsPassed = await _db.LevelProgress.CountAsync(),
        };

        var subs = await _db.Subcategories.AsNoTracking().Include(s => s.Category).ToListAsync();
        var counts = await _db.Questions
            .GroupBy(q => new { q.SubcategoryId, q.Difficulty })
            .Select(g => new { g.Key.SubcategoryId, g.Key.Difficulty, N = g.Count() })
            .ToListAsync();

        foreach (var cat in await _db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Id).ToListAsync())
        {
            var ids = subs.Where(s => s.CategoryId == cat.Id).Select(s => s.Id).ToHashSet();
            int Sum(string d) => counts.Where(x => ids.Contains(x.SubcategoryId) && x.Difficulty == d).Sum(x => x.N);
            vm.Stats.Add(new CategoryStat(cat.Name, Sum("easy"), Sum("medium"), Sum("hard")));
        }
        return View(vm);
    }
}

// ---------------- Categories / subcategories / subjects ----------------
[Route("admin/content")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminContentController : Controller
{
    private readonly AppDbContext _db;
    public AdminContentController(AppDbContext db) => _db = db;

    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var cats = await _db.Categories.AsNoTracking()
            .Include(c => c.Subcategories).ThenInclude(s => s.Subjects)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
            .ToListAsync();
        return View(cats);
    }

    [HttpPost("category")]
    public async Task<IActionResult> AddCategory(string? name, string? description, int? timerMinutes)
    {
        name = name?.Trim();
        if (string.IsNullOrEmpty(name)) return Back("Category name is required.", true);
        if (await _db.Categories.AnyAsync(c => c.Name == name)) return Back("That category already exists.", true);
        _db.Categories.Add(new Category { Name = name, Description = description?.Trim(), TimerMinutes = timerMinutes ?? 5 });
        await _db.SaveChangesAsync();
        return Back("Category added.");
    }

    [HttpGet("category/{id:int}/edit")]
    public async Task<IActionResult> EditCategory(int id)
    {
        var cat = await _db.Categories.AsNoTracking()
            .Include(c => c.Subcategories).ThenInclude(s => s.Subjects)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (cat == null) return NotFound();
        return View("EditCategory", cat);
    }

    [HttpPost("category/{id:int}/edit")]
    public async Task<IActionResult> EditCategorySave(int id, string? name, string? description, int? timerMinutes, double? backgroundOpacity)
    {
        var cat = await _db.Categories
            .Include(c => c.Subcategories).ThenInclude(s => s.Subjects)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (cat == null) return NotFound();

        name = name?.Trim();
        if (string.IsNullOrEmpty(name)) return EditBack(id, "Category name is required.");
        if (await _db.Categories.AnyAsync(c => c.Name == name && c.Id != id)) return EditBack(id, "Another category already has that name.");

        cat.Name = name;
        cat.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        if (timerMinutes != null) cat.TimerMinutes = Math.Clamp(timerMinutes.Value, 1, 180);
        if (backgroundOpacity != null) cat.BackgroundOpacity = Math.Clamp(backgroundOpacity.Value, 0, 1);

        var form = Request.Form;
        var subNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var sub in cat.Subcategories)
        {
            var newName = form[$"subName_{sub.Id}"].ToString().Trim();
            if (newName != "") sub.Name = newName;
            if (!subNames.Add(sub.Name)) return EditBack(id, $"Two subcategories are named \"{sub.Name}\".");

            var subjectNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var subject in sub.Subjects)
            {
                var subjectName = form[$"subjName_{subject.Id}"].ToString().Trim();
                if (subjectName != "") subject.Name = subjectName;
                if (!subjectNames.Add(subject.Name)) return EditBack(id, $"Two subjects in \"{sub.Name}\" are named \"{subject.Name}\".");

                var timerText = form[$"subjTimer_{subject.Id}"].ToString().Trim();
                subject.TimerMinutes = int.TryParse(timerText, out var minutes) ? Math.Clamp(minutes, 1, 180) : null;
            }
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return EditBack(id, "Could not save: a name clashes with an existing one.");
        }

        TempData["Msg"] = "Category updated.";
        return Redirect("/admin/content");
    }

    private IActionResult EditBack(int id, string message)
    {
        TempData["Err"] = message;
        return Redirect($"/admin/content/category/{id}/edit");
    }

    [HttpPost("category/{id:int}/delete")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var cat = await _db.Categories.FindAsync(id);
        if (cat != null)
        {
            _db.Categories.Remove(cat); // everything under it cascades in the database
            await _db.SaveChangesAsync();
        }
        return Back("Category deleted.");
    }

    [HttpPost("category/{id:int}/subcategory")]
    public async Task<IActionResult> AddSubcategory(int id, string? name)
    {
        name = name?.Trim();
        if (string.IsNullOrEmpty(name)) return Back("Name is required.", true);
        if (!await _db.Categories.AnyAsync(c => c.Id == id)) return Back("Category not found.", true);
        if (await _db.Subcategories.AnyAsync(s => s.CategoryId == id && s.Name == name)) return Back("That subcategory already exists.", true);
        _db.Subcategories.Add(new Subcategory { CategoryId = id, Name = name });
        await _db.SaveChangesAsync();
        return Back("Subcategory added.");
    }

    [HttpPost("subcategory/{id:int}/delete")]
    public async Task<IActionResult> DeleteSubcategory(int id)
    {
        var sub = await _db.Subcategories.FindAsync(id);
        if (sub != null)
        {
            _db.Subcategories.Remove(sub);
            await _db.SaveChangesAsync();
        }
        return Back("Subcategory deleted.");
    }

    [HttpPost("subcategory/{id:int}/subject")]
    public async Task<IActionResult> AddSubject(int id, string? name, int? timerMinutes)
    {
        name = name?.Trim();
        if (string.IsNullOrEmpty(name)) return Back("Name is required.", true);
        if (!await _db.Subcategories.AnyAsync(s => s.Id == id)) return Back("Subcategory not found.", true);
        if (await _db.Subjects.AnyAsync(s => s.SubcategoryId == id && s.Name == name)) return Back("That subject already exists.", true);
        _db.Subjects.Add(new Subject { SubcategoryId = id, Name = name, TimerMinutes = timerMinutes });
        await _db.SaveChangesAsync();
        return Back("Subject added.");
    }

    [HttpPost("subject/{id:int}/delete")]
    public async Task<IActionResult> DeleteSubject(int id)
    {
        // Subject links are NoAction in the database, so remove dependants first
        await _db.Questions.Where(q => q.SubjectId == id).ExecuteDeleteAsync();
        await _db.LevelProgress.Where(p => p.SubjectId == id).ExecuteDeleteAsync();
        await _db.Subjects.Where(s => s.Id == id).ExecuteDeleteAsync();
        return Back("Subject deleted.");
    }

    private IActionResult Back(string message, bool isError = false)
    {
        TempData[isError ? "Err" : "Msg"] = message;
        return Redirect("/admin/content");
    }
}

// ---------------- Questions ----------------
[Route("admin/questions")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminQuestionsController : Controller
{
    private const int PageSize = 25;
    private static readonly string[] Difficulties = { "easy", "medium", "hard" };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext _db;
    public AdminQuestionsController(AppDbContext db) => _db = db;

    // Applies the list filters; "any" tells whether at least one filter is active.
    private static IQueryable<Question> ApplyFilters(IQueryable<Question> q, string? target, string? difficulty, string? search, out bool any)
    {
        any = false;
        if (AdminHelpers.TryParseTarget(target, out var subId, out var subjId))
        {
            any = true;
            q = q.Where(x => x.SubcategoryId == subId);
            if (subjId != null) q = q.Where(x => x.SubjectId == subjId);
        }
        if (!string.IsNullOrEmpty(difficulty))
        {
            any = true;
            q = q.Where(x => x.Difficulty == difficulty);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            any = true;
            var term = search.Trim();
            q = q.Where(x => x.QuestionText.Contains(term));
        }
        return q;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(string? target, string? difficulty, string? search, int page = 1)
    {
        var q = ApplyFilters(
            _db.Questions.AsNoTracking()
                .Include(x => x.Subcategory).ThenInclude(s => s!.Category)
                .Include(x => x.Subject),
            target, difficulty, search, out _);

        var total = await q.CountAsync();
        var pages = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
        page = Math.Clamp(page, 1, pages);
        var items = await q.OrderBy(x => x.Id).Skip((page - 1) * PageSize).Take(PageSize).ToListAsync();

        return View(new QuestionListVm
        {
            Items = items,
            Locations = await AdminHelpers.GetLocations(_db),
            Target = target,
            Difficulty = difficulty,
            Search = search,
            Page = page,
            TotalPages = pages,
            Total = total,
        });
    }

    // Deletes every question matching the current filters (at least one filter is required).
    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDelete(string? target, string? difficulty, string? search)
    {
        var q = ApplyFilters(_db.Questions, target, difficulty, search, out var any);
        if (!any)
        {
            TempData["Err"] = "Pick a location, difficulty or search text first. To remove everything, delete the categories instead.";
            return Redirect("/admin/questions");
        }
        var deleted = await q.ExecuteDeleteAsync();
        TempData["Msg"] = $"Deleted {deleted} question(s).";
        return Redirect("/admin/questions");
    }

    [HttpGet("new")]
    public async Task<IActionResult> New(string? target)
    {
        return View("Form", new QuestionFormVm { Target = target, Locations = await AdminHelpers.GetLocations(_db) });
    }

    [HttpPost("new")]
    public async Task<IActionResult> Create(QuestionFormVm vm)
    {
        var error = await Save(vm, null);
        if (error != null)
        {
            vm.Error = error;
            vm.Locations = await AdminHelpers.GetLocations(_db);
            return View("Form", vm);
        }
        TempData["Msg"] = "Question added.";
        return Redirect("/admin/questions?target=" + vm.Target);
    }

    [HttpGet("{id:int}/edit")]
    public async Task<IActionResult> Edit(int id)
    {
        var q = await _db.Questions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (q == null) return NotFound();

        var options = JsonSerializer.Deserialize<List<OptionDto>>(q.OptionsJson, Json) ?? new List<OptionDto>();
        string Text(string letter) => options.FirstOrDefault(o => o.Id == letter)?.Text ?? "";

        return View("Form", new QuestionFormVm
        {
            Id = q.Id,
            Target = $"{q.SubcategoryId}-{q.SubjectId ?? 0}",
            Difficulty = q.Difficulty,
            QuestionText = q.QuestionText,
            OptionA = Text("a"),
            OptionB = Text("b"),
            OptionC = Text("c"),
            OptionD = Text("d"),
            Correct = q.CorrectOptionId,
            Explanation = q.Explanation,
            Locations = await AdminHelpers.GetLocations(_db),
        });
    }

    [HttpPost("{id:int}/edit")]
    public async Task<IActionResult> Edit(int id, QuestionFormVm vm)
    {
        var existing = await _db.Questions.FindAsync(id);
        if (existing == null) return NotFound();

        vm.Id = id;
        var error = await Save(vm, existing);
        if (error != null)
        {
            vm.Error = error;
            vm.Locations = await AdminHelpers.GetLocations(_db);
            return View("Form", vm);
        }
        TempData["Msg"] = "Question updated.";
        return Redirect("/admin/questions?target=" + vm.Target);
    }

    [HttpPost("{id:int}/delete")]
    public async Task<IActionResult> Delete(int id, string? target)
    {
        await _db.Questions.Where(q => q.Id == id).ExecuteDeleteAsync();
        TempData["Msg"] = "Question deleted.";
        return Redirect("/admin/questions?target=" + target);
    }

    // Validates the form and saves; returns an error message or null.
    private async Task<string?> Save(QuestionFormVm vm, Question? existing)
    {
        if (!AdminHelpers.TryParseTarget(vm.Target, out var subId, out var subjId)) return "Choose where this question belongs.";
        if (!await _db.Subcategories.AnyAsync(s => s.Id == subId)) return "That subcategory no longer exists.";
        if (subjId != null && !await _db.Subjects.AnyAsync(s => s.Id == subjId && s.SubcategoryId == subId))
            return "That subject does not belong to the chosen subcategory.";

        var difficulty = (vm.Difficulty ?? "").ToLowerInvariant();
        if (!Difficulties.Contains(difficulty)) return "Choose a difficulty.";
        if (string.IsNullOrWhiteSpace(vm.QuestionText)) return "Question text is required.";

        var options = new List<OptionDto>();
        void Add(string id, string? text)
        {
            if (!string.IsNullOrWhiteSpace(text)) options.Add(new OptionDto(id, text.Trim()));
        }
        Add("a", vm.OptionA); Add("b", vm.OptionB); Add("c", vm.OptionC); Add("d", vm.OptionD);

        if (options.Count < 2) return "Enter at least two options.";
        var correct = (vm.Correct ?? "").ToLowerInvariant();
        if (!options.Any(o => o.Id == correct)) return "The correct answer must be one of the filled-in options.";

        var question = existing ?? new Question();
        question.SubcategoryId = subId;
        question.SubjectId = subjId;
        question.Difficulty = difficulty;
        question.QuestionText = vm.QuestionText.Trim();
        question.OptionsJson = JsonSerializer.Serialize(options, Json);
        question.CorrectOptionId = correct;
        question.Explanation = string.IsNullOrWhiteSpace(vm.Explanation) ? null : vm.Explanation.Trim();

        if (existing == null) _db.Questions.Add(question);
        await _db.SaveChangesAsync();
        return null;
    }
}

// ---------------- CSV import ----------------
[Route("admin/import")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminImportController : Controller
{
    private readonly AppDbContext _db;
    public AdminImportController(AppDbContext db) => _db = db;

    [HttpGet("")]
    public async Task<IActionResult> Index() => View(await Fill(new ImportVm()));

    [HttpPost("")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> Upload(ImportVm vm, IFormFile? file)
    {
        if (string.IsNullOrWhiteSpace(vm.Category) || string.IsNullOrWhiteSpace(vm.Subcategory))
        {
            vm.Error = "Category and subcategory are required.";
            return View("Index", await Fill(vm));
        }

        var difficulty = vm.Difficulty ?? "easy";
        var hasFile = file != null && file.Length > 0;
        var isXlsx = hasFile && file!.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase);

        ContentEndpoints.ImportResult result;
        if (isXlsx)
        {
            using var buffer = new MemoryStream();
            await file!.CopyToAsync(buffer);
            buffer.Position = 0;
            result = await ContentEndpoints.ImportXlsxAsync(_db, buffer, vm.Category, vm.Subcategory, vm.Subject, difficulty);
        }
        else
        {
            // A chosen file wins; otherwise use the pasted text
            string content;
            if (hasFile)
            {
                using var reader = new StreamReader(file!.OpenReadStream());
                content = await reader.ReadToEndAsync();
            }
            else content = vm.Text ?? "";

            if (string.IsNullOrWhiteSpace(content))
            {
                vm.Error = "Choose a file or paste the questions.";
                return View("Index", await Fill(vm));
            }

            result = vm.Format == "json"
                ? await ContentEndpoints.ImportJsonAsync(_db, content, vm.Category, vm.Subcategory, vm.Subject, difficulty)
                : await ContentEndpoints.ImportCsvAsync(_db, content, vm.Category, vm.Subcategory, vm.Subject, difficulty);
        }

        if (result.Error != null) vm.Error = "Import failed: " + result.Error;
        else
        {
            vm.Added = result.Added;
            vm.Skipped = result.Skipped;
            vm.Text = null;
        }
        return View("Index", await Fill(vm));
    }

    private async Task<ImportVm> Fill(ImportVm vm)
    {
        vm.Categories = await _db.Categories.AsNoTracking().OrderBy(c => c.Name).Select(c => c.Name).ToListAsync();
        return vm;
    }
}
