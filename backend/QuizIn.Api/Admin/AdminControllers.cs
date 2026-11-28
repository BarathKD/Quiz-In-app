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
/// <summary>
/// Admin home page (dashboard): total counts and question counts per category.
/// </summary>
[Route("admin")]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminDashboardController : Controller
{
    private readonly AppDbContext _db;
    public AdminDashboardController(AppDbContext db) => _db = db;

    // GET /admin. Counts data and shows the dashboard view (Index) with a DashboardVm.
    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        // Totals for the top cards. Admin accounts are not counted as users.
        var vm = new DashboardVm
        {
            Users = await _db.Users.CountAsync(u => !u.IsAdmin),
            Categories = await _db.Categories.CountAsync(),
            Questions = await _db.Questions.CountAsync(),
            LevelsPassed = await _db.LevelProgress.CountAsync(),
        };

        // Question counts per subcategory and difficulty (one query), then summed per category below.
        var subs = await _db.Subcategories.AsNoTracking().Include(s => s.Category).ToListAsync();
        var counts = await _db.Questions
            .GroupBy(q => new { q.SubcategoryId, q.Difficulty })
            .Select(g => new { g.Key.SubcategoryId, g.Key.Difficulty, N = g.Count() })
            .ToListAsync();

        // One stats row per category: number of easy / medium / hard questions.
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
/// <summary>
/// Manage categories, subcategories and subjects (add, edit, delete). Pages are under /admin/content.
/// </summary>
[Route("admin/content")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminContentController : Controller
{
    private readonly AppDbContext _db;
    private readonly UploadStore _uploads;
    public AdminContentController(AppDbContext db, UploadStore uploads) { _db = db; _uploads = uploads; }

    // GET /admin/content. Lists all categories with their subcategories and subjects (view: Index).
    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var cats = await _db.Categories.AsNoTracking()
            .Include(c => c.Subcategories).ThenInclude(s => s.Subjects)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
            .ToListAsync();
        return View(cats);
    }

    // POST /admin/content/category. Adds a new category (name must be unique). Redirects back to /admin/content.
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

    // GET /admin/content/category/{id}/edit. Shows the edit page (view: EditCategory). 404 if not found.
    [HttpGet("category/{id:int}/edit")]
    public async Task<IActionResult> EditCategory(int id)
    {
        var cat = await _db.Categories.AsNoTracking()
            .Include(c => c.Subcategories).ThenInclude(s => s.Subjects)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (cat == null) return NotFound();
        return View("EditCategory", cat);
    }

    // POST /admin/content/category/{id}/edit. Saves category, subcategory and subject names, timers and images.
    // On a problem it goes back to the edit page with an error; on success it redirects to /admin/content.
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

        // Subcategory / subject values come from form fields named subName_{id}, subjName_{id}, subjTimer_{id}.
        var form = Request.Form;
        // Names must be unique inside the same parent (upper/lower case ignored).
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

                // Empty or bad timer = null (use the default timer); otherwise limit to 1-180 minutes.
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

        // Save everything together. The database can still reject a duplicate name (unique index).
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return EditBack(id, "Could not save: a name clashes with an existing one.");
        }

        // Delete replaced / removed image files only after the database save worked.
        foreach (var old in oldImages) _uploads.Delete(old);
        TempData["Msg"] = "Category updated.";
        return Redirect("/admin/content");
    }

    // Redirects to the edit page and shows the message there (TempData["Err"]).
    private IActionResult EditBack(int id, string message)
    {
        TempData["Err"] = message;
        return Redirect($"/admin/content/category/{id}/edit");
    }

    // POST /admin/content/category/{id}/delete. Deletes a category and everything under it.
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

    // POST /admin/content/category/{id}/subcategory. Adds a subcategory to a category (name must be unique inside it).
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

    // POST /admin/content/subcategory/{id}/delete. Deletes a subcategory.
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

    // POST /admin/content/subcategory/{id}/subject. Adds a subject (optional own timer) to a subcategory.
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

    // POST /admin/content/subject/{id}/delete. Deletes a subject with its questions and level progress.
    [HttpPost("subject/{id:int}/delete")]
    public async Task<IActionResult> DeleteSubject(int id)
    {
        // Subject links are NoAction in the database, so remove dependants first
        await _db.Questions.Where(q => q.SubjectId == id).ExecuteDeleteAsync();
        await _db.LevelProgress.Where(p => p.SubjectId == id).ExecuteDeleteAsync();
        await _db.Subjects.Where(s => s.Id == id).ExecuteDeleteAsync();
        return Back("Subject deleted.");
    }

    // Redirects to /admin/content with a success message (TempData["Msg"]) or an error message (TempData["Err"]).
    private IActionResult Back(string message, bool isError = false)
    {
        TempData[isError ? "Err" : "Msg"] = message;
        return Redirect("/admin/content");
    }
}

// ---------------- Questions ----------------
/// <summary>
/// Question list with filters and paging, add / edit / delete, bulk delete and Excel export.
/// </summary>
[Route("admin/questions")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminQuestionsController : Controller
{
    // Number of questions on one page of the list.
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

    // GET /admin/questions?target=&difficulty=&search=&page=. Shows one page of questions (view: Index).
    [HttpGet("")]
    public async Task<IActionResult> Index(string? target, string? difficulty, string? search, int page = 1)
    {
        var q = ApplyFilters(
            _db.Questions.AsNoTracking()
                .Include(x => x.Subcategory).ThenInclude(s => s!.Category)
                .Include(x => x.Subject),
            target, difficulty, search, out _);

        // Paging: count all matches, then keep the page number between 1 and the last page.
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
    // POST /admin/questions/bulk-delete. Redirects to /admin/questions with a message.
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
    // GET /admin/questions/export. Downloads quiz-questions.xlsx (at most 20000 rows).
    [HttpGet("export")]
    public async Task<IActionResult> Export(string? target, string? difficulty, string? search)
    {
        var list = await ApplyFilters(
            _db.Questions.AsNoTracking()
                .Include(x => x.Subcategory).ThenInclude(s => s!.Category)
                .Include(x => x.Subject),
            target, difficulty, search, out _).OrderBy(x => x.Id).Take(20000).ToListAsync();

        // First row is the header. Column order must match the import columns so the file can be uploaded again.
        var rows = new List<List<string>> { new() { "qid", "category", "subcategory", "subject", "difficulty", "question", "A", "B", "C", "D", "answer", "explanation" } };
        foreach (var q in list)
        {
            // Options are stored as JSON text. Here they are read back into columns A-D.
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

    // GET /admin/questions/new. Shows an empty question form (view: Form).
    [HttpGet("new")]
    public async Task<IActionResult> New(string? target)
    {
        return View("Form", new QuestionFormVm { Target = target, Locations = await AdminHelpers.GetLocations(_db) });
    }

    // POST /admin/questions/new. Validates and saves a new question. On error it shows the form again; on success it redirects to /admin/questions.
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

    // GET /admin/questions/{id}/edit. Shows the form (view: Form) filled with this question. 404 if not found.
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

    // POST /admin/questions/{id}/edit. Validates and updates the question. Same result handling as Create.
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

    // POST /admin/questions/{id}/delete. Deletes one question and redirects to the list.
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

        // Normalise: difficulty and answer id are stored in lower case.
        var difficulty = (vm.Difficulty ?? "").ToLowerInvariant();
        if (!Difficulties.Contains(difficulty)) return "Choose a difficulty.";
        if (string.IsNullOrWhiteSpace(vm.QuestionText)) return "Question text is required.";

        // Keep only filled-in options. Their ids stay a-d by position.
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
/// <summary>
/// Bulk import of questions: upload / paste, preview, commit, undo and history. The work is done in ImportService.
/// </summary>
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

    // Gets the draft from the memory cache. Returns null when it has expired.
    private ImportDraft? GetDraft(Guid token) => _cache.TryGetValue(token, out ImportDraft? d) ? d : null;
    // Used when the draft is gone (cache time is over): show a message and go back to the upload page.
    private IActionResult Expired()
    {
        TempData["Err"] = "That import expired. Upload the file again.";
        return Redirect("/admin/import");
    }

    // GET /admin/import. Shows the upload form (view: Index).
    [HttpGet("")]
    public async Task<IActionResult> Index() => View(await Fill(new ImportVm()));

    // Step 1: read the file / pasted text into a draft and show the preview. Nothing is saved yet.
    // POST /admin/import/preview. Redirects to /admin/import/preview/{token} when the file is OK, otherwise shows the form with an error.
    [HttpPost("preview")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> Preview(ImportVm vm, IFormFile? file)
    {
        // Default difficulty from the form. If it is not valid, use easy.
        var difficulty = Difficulties.Contains((vm.Difficulty ?? "").ToLowerInvariant()) ? vm.Difficulty!.ToLowerInvariant() : "easy";
        var defaults = new ImportDefaults(vm.Category, vm.Subcategory, vm.Subject, difficulty);
        var hasFile = file != null && file.Length > 0;
        var name = hasFile ? Path.GetFileName(file!.FileName) : "pasted text";

        ImportDraft? draft;
        string? error;
        // Excel (.xlsx) is read with XlsxReader. Other files and pasted text are read as text below.
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

            // JSON if the file name ends with .json (or pasted text with format = json). Everything else is CSV.
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

        // Keep the draft in memory for 1 hour so the preview and commit steps can use it.
        _cache.Set(draft.Token, draft, TimeSpan.FromHours(1));
        return Redirect("/admin/import/preview/" + draft.Token);
    }

    // GET /admin/import/preview/{token}. Marks each row as new / duplicate / update / error and shows the preview (view: Preview).
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
    // POST /admin/import/preview/{token}/split. Saves the split settings and redirects back to the preview.
    [HttpPost("preview/{token:guid}/split")]
    public IActionResult Split(Guid token, string? splitMode, string? defaultDifficulty, int easyCount, int mediumCount)
    {
        var draft = GetDraft(token);
        if (draft == null) return Expired();
        ApplySplitFields(draft, splitMode, defaultDifficulty, easyCount, mediumCount);
        return Redirect("/admin/import/preview/" + token);
    }

    // Copies the split form values into the draft (with safe limits) and recalculates the difficulty of each row.
    private static void ApplySplitFields(ImportDraft draft, string? mode, string? defaultDifficulty, int easy, int medium)
    {
        draft.SplitMode = mode == "split" ? "split" : "single";
        if (defaultDifficulty != null && Difficulties.Contains(defaultDifficulty)) draft.DefaultDifficulty = defaultDifficulty;
        draft.EasyCount = Math.Max(0, easy);
        draft.MediumCount = Math.Max(0, medium);
        ImportService.ApplySplit(draft);
    }

    // Step 2: save the ticked rows.
    // POST /admin/import/commit/{token}. Saves the ticked rows (sel) and redirects to the result page.
    [HttpPost("commit/{token:guid}")]
    public async Task<IActionResult> Commit(Guid token, int[]? sel, string? duplicates, bool shuffle,
        string? splitMode, string? defaultDifficulty, int easyCount, int mediumCount)
    {
        var draft = GetDraft(token);
        if (draft == null) return Expired();
        if (draft.Result != null) return Redirect("/admin/import/result/" + token); // double click / refresh

        ApplySplitFields(draft, splitMode, defaultDifficulty, easyCount, mediumCount);
        // Duplicate policy: skip, update or allow. Anything else becomes skip (the safest).
        var policy = duplicates is "update" or "allow" ? duplicates : "skip";
        var email = User.FindFirstValue(ClaimTypes.Email) ?? "admin";
        await ImportService.CommitAsync(_db, draft, (sel ?? Array.Empty<int>()).ToHashSet(), policy, shuffle, email);
        return Redirect("/admin/import/result/" + token);
    }

    // GET /admin/import/result/{token}. Shows how many questions were added, updated or skipped (view: Result).
    [HttpGet("result/{token:guid}")]
    public IActionResult Result(Guid token)
    {
        var draft = GetDraft(token);
        if (draft?.Result == null) return Expired();
        return View("Result", draft);
    }

    // GET /admin/import/errors/{token}. Downloads an Excel file with the rows that were not imported and the reason.
    [HttpGet("errors/{token:guid}")]
    public IActionResult ErrorReport(Guid token)
    {
        var draft = GetDraft(token);
        if (draft == null) return Expired();
        return File(XlsxWriter.Write(ImportService.ErrorSheet(draft), "Not imported"), XlsxType, "quiz-import-errors.xlsx");
    }

    // GET /admin/import/template. Downloads an example Excel file with the right columns.
    [HttpGet("template")]
    public IActionResult Template() =>
        File(XlsxWriter.Write(ImportService.TemplateSheet()), XlsxType, "quiz-import-template.xlsx");

    // GET /admin/import/history. Shows the last 100 imports (view: History).
    [HttpGet("history")]
    public async Task<IActionResult> History() =>
        View(await _db.ImportBatches.AsNoTracking().OrderByDescending(b => b.Id).Take(100).ToListAsync());

    // Removes the questions this import added. Questions it only updated are left as they are now.
    // POST /admin/import/undo/{id}. Redirects to /admin/import/history with a message.
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

    // Loads category / subcategory / subject names for the dropdowns of the import form.
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
/// <summary>
/// App users list (admin accounts are hidden) and delete user.
/// </summary>
[Route("admin/users")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminUsersController : Controller
{
    private const int PageSize = 25;
    private readonly AppDbContext _db;
    public AdminUsersController(AppDbContext db) => _db = db;

    // GET /admin/users?search=&page=. Shows one page of users with the number of levels each one passed (view: Index).
    [HttpGet("")]
    public async Task<IActionResult> Index(string? search, int page = 1)
    {
        var q = _db.Users.AsNoTracking().Where(u => !u.IsAdmin);
        // Search by email (case is ignored because the term is lower case).
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            q = q.Where(u => u.Email.Contains(term));
        }

        // Paging: keep the page number between 1 and the last page.
        var total = await q.CountAsync();
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
        page = Math.Clamp(page, 1, totalPages);

        var users = await q.OrderByDescending(u => u.CreatedAt).Skip((page - 1) * PageSize).Take(PageSize).ToListAsync();
        var ids = users.Select(u => u.Id).ToList();
        // Number of passed levels per user, counted in one query.
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

    // POST /admin/users/{id}/delete. Deletes an app user. Admin accounts are protected. Redirects to /admin/users.
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
/// <summary>
/// Game settings page (one settings record in the database).
/// </summary>
[Route("admin/settings")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminSettingsController : Controller
{
    private readonly AppDbContext _db;
    public AdminSettingsController(AppDbContext db) => _db = db;

    // GET /admin/settings. Shows the current game settings (view: Index).
    [HttpGet("")]
    public async Task<IActionResult> Index() => View(await GameSettingsStore.LoadAsync(_db));

    // POST /admin/settings. Saves the settings and redirects to /admin/settings.
    [HttpPost("")]
    public async Task<IActionResult> Save(GameSettings settings)
    {
        await GameSettingsStore.SaveAsync(_db, settings);
        TempData["Msg"] = "Settings saved. The app picks them up the next time it starts.";
        return Redirect("/admin/settings");
    }

    // POST /admin/settings/reset. Puts all settings back to the default values.
    [HttpPost("reset")]
    public async Task<IActionResult> Reset()
    {
        await GameSettingsStore.SaveAsync(_db, new GameSettings());
        TempData["Msg"] = "Settings reset to the defaults.";
        return Redirect("/admin/settings");
    }
}


// ---------------- Reported questions ----------------
/// <summary>
/// View model: all reports of one question grouped together (count, reasons, some notes, latest date).
/// </summary>
public class ReportGroupVm
{
    public Question Question { get; set; } = null!;
    public int Count { get; set; }
    public Dictionary<string, int> Reasons { get; set; } = new();
    public List<string> Notes { get; set; } = new();
    public DateTime Latest { get; set; }
    public List<OptionDto> Options { get; set; } = new();
}

/// <summary>
/// View model for the reports page: selected status, number of open questions and the groups.
/// </summary>
public class ReportsVm
{
    public string Status { get; set; } = "open";
    public int OpenCount { get; set; }
    public List<ReportGroupVm> Groups { get; set; } = new();
}

/// <summary>
/// Reports sent by app users about wrong questions. Admin can mark them fixed or dismissed.
/// </summary>
[Route("admin/reports")]
[AutoValidateAntiforgeryToken]
[Authorize(AuthenticationSchemes = AdminHelpers.Scheme, Roles = "Admin")]
public class AdminReportsController : Controller
{
    private readonly AppDbContext _db;
    public AdminReportsController(AppDbContext db) => _db = db;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // GET /admin/reports?status=open|fixed|dismissed. Shows reported questions, most reported first (view: Index).
    [HttpGet("")]
    public async Task<IActionResult> Index(string? status)
    {
        // Only fixed or dismissed are allowed. Anything else means open.
        status = (status == "fixed" || status == "dismissed") ? status : "open";
        var reports = await _db.QuestionReports.AsNoTracking()
            .Where(r => r.Status == status).OrderByDescending(r => r.CreatedAt).Take(1000).ToListAsync();
        // Load the reported questions in one query, then group the reports per question.
        var ids = reports.Select(r => r.QuestionId).Distinct().ToList();
        var questions = ids.Count == 0 ? new List<Question>()
            : await ContentEndpoints.QuestionQuery(_db).Where(q => ids.Contains(q.Id)).ToListAsync();
        var byId = questions.ToDictionary(q => q.Id);

        var groups = reports.GroupBy(r => r.QuestionId)
            .Where(g => byId.ContainsKey(g.Key))
            .Select(g => new ReportGroupVm
            {
                Question = byId[g.Key],
                Count = g.Count(),
                Reasons = g.GroupBy(r => r.Reason).ToDictionary(x => x.Key, x => x.Count()),
                Notes = g.Where(r => !string.IsNullOrWhiteSpace(r.Note)).Select(r => r.Note!).Take(3).ToList(),
                Latest = g.Max(r => r.CreatedAt),
                Options = JsonSerializer.Deserialize<List<OptionDto>>(byId[g.Key].OptionsJson, JsonOpts) ?? new List<OptionDto>(),
            })
            .OrderByDescending(x => x.Count).ThenByDescending(x => x.Latest).ToList();

        return View(new ReportsVm
        {
            Status = status,
            OpenCount = await _db.QuestionReports.Where(r => r.Status == "open").Select(r => r.QuestionId).Distinct().CountAsync(),
            Groups = groups,
        });
    }

    // POST /admin/reports/resolve/{questionId}. Returns 400 if status is not fixed or dismissed. Redirects to /admin/reports.
    // Closes every open report of one question. status: fixed | dismissed
    [HttpPost("resolve/{questionId:int}")]
    public async Task<IActionResult> Resolve(int questionId, string status)
    {
        if (status != "fixed" && status != "dismissed") return BadRequest();
        var now = DateTime.UtcNow;
        await _db.QuestionReports.Where(r => r.QuestionId == questionId && r.Status == "open")
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, status).SetProperty(r => r.ResolvedAt, (DateTime?)now));
        TempData["Msg"] = status == "fixed" ? "Marked as fixed." : "Reports dismissed.";
        return Redirect("/admin/reports");
    }
}
