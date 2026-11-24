using System.Security.Claims;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
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
    private readonly UploadStore _uploads;
    public AdminContentController(AppDbContext db, UploadStore uploads) { _db = db; _uploads = uploads; }

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
    [RequestSizeLimit(30_000_000)]
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

        // Images: a new file replaces the old one; the checkbox removes it.
        var oldImages = new List<string?>();
        async Task<string?> ApplyImage(string fileField, string removeField, string? current, Action<string?> set)
        {
            var upload = form.Files.GetFile(fileField);
            if (upload != null && upload.Length > 0)
            {
                var (url, error) = await _uploads.SaveImageAsync(upload);
                if (error != null) return error;
                oldImages.Add(current);
                set(url);
            }
            else if (form[removeField].ToString() == "on" && current != null)
            {
                oldImages.Add(current);
                set(null);
            }
            return null;
        }

        var imageError = await ApplyImage("categoryImage", "categoryImageRemove", cat.ImageUrl, v => cat.ImageUrl = v);
        if (imageError != null) return EditBack(id, imageError);
        foreach (var sub in cat.Subcategories)
        {
            foreach (var subject in sub.Subjects)
            {
                imageError = await ApplyImage($"subjImg_{subject.Id}", $"subjImgRemove_{subject.Id}", subject.ImageUrl, v => subject.ImageUrl = v);
                if (imageError != null) return EditBack(id, $"{subject.Name}: {imageError}");
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

        foreach (var old in oldImages) _uploads.Delete(old);
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

    // Excel export of the filtered questions. Keep the qid column to update them by re-uploading the edited file.
    [HttpGet("export")]
    public async Task<IActionResult> Export(string? target, string? difficulty, string? search)
    {
        var list = await ApplyFilters(
            _db.Questions.AsNoTracking()
                .Include(x => x.Subcategory).ThenInclude(s => s!.Category)
                .Include(x => x.Subject),
            target, difficulty, search, out _).OrderBy(x => x.Id).Take(20000).ToListAsync();

        var rows = new List<List<string>> { new() { "qid", "category", "subcategory", "subject", "difficulty", "question", "A", "B", "C", "D", "answer", "explanation" } };
        foreach (var q in list)
        {
            var options = JsonSerializer.Deserialize<List<OptionDto>>(q.OptionsJson, Json) ?? new List<OptionDto>();
            string Opt(string id) => options.FirstOrDefault(o => o.Id == id)?.Text ?? "";
            rows.Add(new List<string>
            {
                q.Id.ToString(), q.Subcategory?.Category?.Name ?? "", q.Subcategory?.Name ?? "", q.Subject?.Name ?? "",
                q.Difficulty, q.QuestionText, Opt("a"), Opt("b"), Opt("c"), Opt("d"), q.CorrectOptionId.ToUpperInvariant(), q.Explanation ?? "",
            });
        }
        return File(XlsxWriter.Write(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "quiz-questions.xlsx");
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

// ---------------- Bulk import ----------------
[Route("admin/import")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminImportController : Controller
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    public AdminImportController(AppDbContext db, IMemoryCache cache) { _db = db; _cache = cache; }

    private static readonly string[] Difficulties = { "easy", "medium", "hard" };
    private const string XlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private ImportDraft? GetDraft(Guid token) => _cache.TryGetValue(token, out ImportDraft? d) ? d : null;
    private IActionResult Expired()
    {
        TempData["Err"] = "That import expired. Upload the file again.";
        return Redirect("/admin/import");
    }

    [HttpGet("")]
    public async Task<IActionResult> Index() => View(await Fill(new ImportVm()));

    // Step 1: read the file / pasted text into a draft and show the preview. Nothing is saved yet.
    [HttpPost("preview")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> Preview(ImportVm vm, IFormFile? file)
    {
        var difficulty = Difficulties.Contains((vm.Difficulty ?? "").ToLowerInvariant()) ? vm.Difficulty!.ToLowerInvariant() : "easy";
        var defaults = new ImportDefaults(vm.Category, vm.Subcategory, vm.Subject, difficulty);
        var hasFile = file != null && file.Length > 0;
        var name = hasFile ? Path.GetFileName(file!.FileName) : "pasted text";

        ImportDraft? draft;
        string? error;
        if (hasFile && name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            using var buffer = new MemoryStream();
            await file!.CopyToAsync(buffer);
            buffer.Position = 0;
            List<List<string>> rows;
            try { rows = XlsxReader.ReadFirstSheet(buffer); }
            catch (Exception ex) when (ex is InvalidDataException or System.Xml.XmlException or IOException)
            {
                vm.Error = "That does not look like a valid .xlsx file.";
                return View("Index", await Fill(vm));
            }
            draft = ImportService.BuildFromTable(rows, defaults, name, out error);
        }
        else
        {
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

            var isJson = name.EndsWith(".json", StringComparison.OrdinalIgnoreCase) || (!hasFile && vm.Format == "json");
            draft = isJson
                ? ImportService.BuildFromJson(content, defaults, name, out error)
                : ImportService.BuildFromTable(CsvParser.Parse(content), defaults, name, out error);
        }

        if (draft == null)
        {
            vm.Error = error;
            return View("Index", await Fill(vm));
        }

        _cache.Set(draft.Token, draft, TimeSpan.FromHours(1));
        return Redirect("/admin/import/preview/" + draft.Token);
    }

    [HttpGet("preview/{token:guid}")]
    public async Task<IActionResult> PreviewPage(Guid token)
    {
        var draft = GetDraft(token);
        if (draft == null) return Expired();
        ImportService.ApplySplit(draft);
        await ImportService.AnnotateAsync(_db, draft);
        return View("Preview", draft);
    }

    // Re-applies the difficulty split without importing.
    [HttpPost("preview/{token:guid}/split")]
    public IActionResult Split(Guid token, string? splitMode, string? defaultDifficulty, int easyCount, int mediumCount)
    {
        var draft = GetDraft(token);
        if (draft == null) return Expired();
        ApplySplitFields(draft, splitMode, defaultDifficulty, easyCount, mediumCount);
        return Redirect("/admin/import/preview/" + token);
    }

    private static void ApplySplitFields(ImportDraft draft, string? mode, string? defaultDifficulty, int easy, int medium)
    {
        draft.SplitMode = mode == "split" ? "split" : "single";
        if (defaultDifficulty != null && Difficulties.Contains(defaultDifficulty)) draft.DefaultDifficulty = defaultDifficulty;
        draft.EasyCount = Math.Max(0, easy);
        draft.MediumCount = Math.Max(0, medium);
        ImportService.ApplySplit(draft);
    }

    // Step 2: save the ticked rows.
    [HttpPost("commit/{token:guid}")]
    public async Task<IActionResult> Commit(Guid token, int[]? sel, string? duplicates, bool shuffle,
        string? splitMode, string? defaultDifficulty, int easyCount, int mediumCount)
    {
        var draft = GetDraft(token);
        if (draft == null) return Expired();
        if (draft.Result != null) return Redirect("/admin/import/result/" + token); // double click / refresh

        ApplySplitFields(draft, splitMode, defaultDifficulty, easyCount, mediumCount);
        var policy = duplicates is "update" or "allow" ? duplicates : "skip";
        var email = User.FindFirstValue(ClaimTypes.Email) ?? "admin";
        await ImportService.CommitAsync(_db, draft, (sel ?? Array.Empty<int>()).ToHashSet(), policy, shuffle, email);
        return Redirect("/admin/import/result/" + token);
    }

    [HttpGet("result/{token:guid}")]
    public IActionResult Result(Guid token)
    {
        var draft = GetDraft(token);
        if (draft?.Result == null) return Expired();
        return View("Result", draft);
    }

    [HttpGet("errors/{token:guid}")]
    public IActionResult ErrorReport(Guid token)
    {
        var draft = GetDraft(token);
        if (draft == null) return Expired();
        return File(XlsxWriter.Write(ImportService.ErrorSheet(draft), "Not imported"), XlsxType, "quiz-import-errors.xlsx");
    }

    [HttpGet("template")]
    public IActionResult Template() =>
        File(XlsxWriter.Write(ImportService.TemplateSheet()), XlsxType, "quiz-import-template.xlsx");

    [HttpGet("history")]
    public async Task<IActionResult> History() =>
        View(await _db.ImportBatches.AsNoTracking().OrderByDescending(b => b.Id).Take(100).ToListAsync());

    // Removes the questions this import added. Questions it only updated are left as they are now.
    [HttpPost("undo/{id:int}")]
    public async Task<IActionResult> Undo(int id)
    {
        var batch = await _db.ImportBatches.FirstOrDefaultAsync(b => b.Id == id);
        if (batch == null) return NotFound();
        if (batch.Undone)
        {
            TempData["Err"] = "That import was already undone.";
            return Redirect("/admin/import/history");
        }
        var removed = await _db.Questions.Where(q => q.ImportBatchId == id).ExecuteDeleteAsync();
        batch.Undone = true;
        await _db.SaveChangesAsync();
        TempData["Msg"] = $"Import #{id} undone: {removed} question(s) removed.";
        return Redirect("/admin/import/history");
    }

    private async Task<ImportVm> Fill(ImportVm vm)
    {
        var cats = await _db.Categories.AsNoTracking()
            .Include(c => c.Subcategories).ThenInclude(s => s.Subjects)
            .OrderBy(c => c.Name).ToListAsync();
        vm.Categories = cats.Select(c => c.Name).ToList();
        vm.Tree = cats.Select(c => new ImportCategoryNode(c.Name,
            c.Subcategories.OrderBy(s => s.Id).Select(s => new ImportSubNode(s.Name,
                s.Subjects.OrderBy(x => x.Id).Select(x => x.Name).ToList())).ToList())).ToList();
        return vm;
    }
}


// ---------------- Users ----------------
[Route("admin/users")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminUsersController : Controller
{
    private const int PageSize = 25;
    private readonly AppDbContext _db;
    public AdminUsersController(AppDbContext db) => _db = db;

    [HttpGet("")]
    public async Task<IActionResult> Index(string? search, int page = 1)
    {
        var q = _db.Users.AsNoTracking().Where(u => !u.IsAdmin);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            q = q.Where(u => u.Email.Contains(term));
        }

        var total = await q.CountAsync();
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
        page = Math.Clamp(page, 1, totalPages);

        var users = await q.OrderByDescending(u => u.CreatedAt).Skip((page - 1) * PageSize).Take(PageSize).ToListAsync();
        var ids = users.Select(u => u.Id).ToList();
        var levels = await _db.LevelProgress.Where(p => ids.Contains(p.UserId))
            .GroupBy(p => p.UserId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N);

        return View(new UsersVm
        {
            Search = search,
            Page = page,
            TotalPages = totalPages,
            Total = total,
            Items = users.Select(u => new UserRow(u.Id, u.Email, u.CreatedAt, levels.GetValueOrDefault(u.Id))).ToList(),
        });
    }

    [HttpPost("{id:guid}/delete")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();
        if (user.IsAdmin)
        {
            TempData["Err"] = "Admin accounts cannot be deleted here.";
            return Redirect("/admin/users");
        }
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        TempData["Msg"] = "User deleted.";
        return Redirect("/admin/users");
    }
}


// ---------------- Game settings ----------------
[Route("admin/settings")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminSettingsController : Controller
{
    private readonly AppDbContext _db;
    public AdminSettingsController(AppDbContext db) => _db = db;

    [HttpGet("")]
    public async Task<IActionResult> Index() => View(await GameSettingsStore.LoadAsync(_db));

    [HttpPost("")]
    public async Task<IActionResult> Save(GameSettings settings)
    {
        await GameSettingsStore.SaveAsync(_db, settings);
        TempData["Msg"] = "Settings saved. The app picks them up the next time it starts.";
        return Redirect("/admin/settings");
    }

    [HttpPost("reset")]
    public async Task<IActionResult> Reset()
    {
        await GameSettingsStore.SaveAsync(_db, new GameSettings());
        TempData["Msg"] = "Settings reset to the defaults.";
        return Redirect("/admin/settings");
    }
}
