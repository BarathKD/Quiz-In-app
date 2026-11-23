using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Content;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Admin;

// One parsed spreadsheet / JSON row waiting in the import preview.
public class DraftRow
{
    public int RowNo { get; set; }                    // row number in the file (1 = first row)
    public int? Qid { get; set; }                     // existing question id (from an export) -> update that question
    public string Category { get; set; } = "";
    public string Subcategory { get; set; } = "";
    public string Subject { get; set; } = "";
    public string? FileDifficulty { get; set; }       // difficulty given in the file (validated)
    public string RawDifficulty { get; set; } = "";
    public string Difficulty { get; set; } = "easy";  // final difficulty (file value, split or default)
    public string QuestionText { get; set; } = "";
    public string[] RawOptions { get; set; } = { "", "", "", "" };
    public string RawAnswer { get; set; } = "";
    public string? Explanation { get; set; }
    public string? Error { get; set; }
    public string Status { get; set; } = "new";       // new | duplicate | update | error
    public int? ExistingId { get; set; }
    public string? SkipReason { get; set; }           // filled in on import
    public string CorrectId { get; set; } = "";
    public List<OptionDto> Options { get; set; } = new();
}

public class CommitResult
{
    public int BatchId { get; set; }
    public int Added { get; set; }
    public int Updated { get; set; }
    public List<DraftRow> Skipped { get; set; } = new();
}

public class ImportDraft
{
    public Guid Token { get; set; } = Guid.NewGuid();
    public string FileName { get; set; } = "";
    public List<DraftRow> Rows { get; set; } = new();
    public string SplitMode { get; set; } = "single"; // single | split
    public string DefaultDifficulty { get; set; } = "easy";
    public int EasyCount { get; set; }
    public int MediumCount { get; set; }
    public CommitResult? Result { get; set; }

    // Valid rows whose difficulty is not in the file (these are what the split applies to)
    public int Assignable => Rows.Count(r => r.Error == null && r.FileDifficulty == null);
}

public record ImportDefaults(string? Category, string? Subcategory, string? Subject, string Difficulty);

public static class ImportService
{
    public const int MaxRows = 5000;
    private static readonly string[] Difficulties = { "easy", "medium", "hard" };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static readonly Dictionary<string, string> Aliases = new()
    {
        ["qid"] = "qid", ["questionid"] = "qid",
        ["category"] = "category",
        ["subcategory"] = "subcategory", ["class"] = "subcategory",
        ["subject"] = "subject",
        ["difficulty"] = "difficulty", ["level"] = "difficulty",
        ["question"] = "question", ["questiontext"] = "question",
        ["a"] = "a", ["optiona"] = "a", ["option1"] = "a",
        ["b"] = "b", ["optionb"] = "b", ["option2"] = "b",
        ["c"] = "c", ["optionc"] = "c", ["option3"] = "c",
        ["d"] = "d", ["optiond"] = "d", ["option4"] = "d",
        ["answer"] = "answer", ["correct"] = "answer", ["correctanswer"] = "answer",
        ["explanation"] = "explanation",
    };

    private static string Norm(string s) => new string(s.Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    internal static string NormText(string s) => string.Join(' ', s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();
    private static string Key(string cat, string sub, string subj, string text) =>
        $"{cat.Trim().ToLowerInvariant()}|{sub.Trim().ToLowerInvariant()}|{subj.Trim().ToLowerInvariant()}|{NormText(text)}";

    // ---------- parsing ----------
    // Spreadsheet / CSV. With a header row, columns are found by name (category, subcategory, subject, difficulty, question,
    // A-D, answer, explanation, qid). Without one the old layout is used: id, question, A, B, C, D, answer, explanation.
    public static ImportDraft? BuildFromTable(List<List<string>> all, ImportDefaults d, string fileName, out string? error)
    {
        error = null;
        var rows = all.Select((r, i) => (cells: r, no: i + 1)).Where(x => x.cells.Any(c => c != "")).ToList();
        if (rows.Count == 0) { error = "The file is empty."; return null; }

        var map = new Dictionary<string, int>();
        var first = rows[0].cells;
        for (var i = 0; i < first.Count; i++)
            if (Aliases.TryGetValue(Norm(first[i]), out var key) && !map.ContainsKey(key)) map[key] = i;

        var hasHeader = map.ContainsKey("question") || map.ContainsKey("answer");
        if (!hasHeader)
            map = new Dictionary<string, int> { ["question"] = 1, ["a"] = 2, ["b"] = 3, ["c"] = 4, ["d"] = 5, ["answer"] = 6, ["explanation"] = 7 };

        var data = hasHeader ? rows.Skip(1).ToList() : rows;
        if (data.Count == 0) { error = "The file has a header row but no questions."; return null; }
        if (data.Count > MaxRows) { error = $"Too many rows ({data.Count}). Import at most {MaxRows} per file."; return null; }

        string Get(List<string> r, string key) => map.TryGetValue(key, out var i) && i < r.Count ? r[i].Trim() : "";

        var draft = new ImportDraft { FileName = fileName, DefaultDifficulty = d.Difficulty };
        foreach (var (cells, no) in data)
        {
            var row = new DraftRow
            {
                RowNo = no,
                QuestionText = Get(cells, "question"),
                RawOptions = new[] { Get(cells, "a"), Get(cells, "b"), Get(cells, "c"), Get(cells, "d") },
                RawAnswer = Get(cells, "answer"),
                Explanation = Get(cells, "explanation") is { Length: > 0 } ex ? ex : null,
                RawDifficulty = Get(cells, "difficulty"),
            };

            // Location: the row's own category columns win; otherwise the default chosen on the form
            if (Get(cells, "category") != "")
            {
                row.Category = Get(cells, "category");
                row.Subcategory = Get(cells, "subcategory");
                row.Subject = Get(cells, "subject");
            }
            else
            {
                row.Category = d.Category?.Trim() ?? "";
                row.Subcategory = d.Subcategory?.Trim() ?? "";
                row.Subject = d.Subject?.Trim() ?? "";
            }

            var qid = Get(cells, "qid");
            if (qid != "")
            {
                if (int.TryParse(qid, out var parsed) && parsed > 0) row.Qid = parsed;
                else row.Error = "qid must be a number";
            }
            Validate(row);
            draft.Rows.Add(row);
        }
        return draft;
    }

    // JSON: array of { questionText, options:[{id,text}], correctOptionId, explanation, category?, subcategory?, subject?, difficulty? }
    public static ImportDraft? BuildFromJson(string json, ImportDefaults d, string fileName, out string? error)
    {
        error = null;
        List<QuestionInput>? items;
        try { items = JsonSerializer.Deserialize<List<QuestionInput>>(json, Json); }
        catch (JsonException) { error = "That is not valid JSON. Expected an array of questions."; return null; }
        if (items == null || items.Count == 0) { error = "The JSON has no questions."; return null; }
        if (items.Count > MaxRows) { error = $"Too many questions ({items.Count}). Import at most {MaxRows} per file."; return null; }

        var draft = new ImportDraft { FileName = fileName, DefaultDifficulty = d.Difficulty };
        for (var i = 0; i < items.Count; i++)
        {
            var it = items[i];
            var opts = it.Options ?? new List<OptionDto>();
            var raw = new[] { "", "", "", "" };
            for (var k = 0; k < opts.Count && k < 4; k++) raw[k] = opts[k].Text?.Trim() ?? "";
            var correctIndex = opts.FindIndex(o => o.Id == it.CorrectOptionId);

            var own = !string.IsNullOrWhiteSpace(it.Category);
            var row = new DraftRow
            {
                RowNo = i + 1,
                QuestionText = it.QuestionText?.Trim() ?? "",
                RawOptions = raw,
                RawAnswer = correctIndex >= 0 && correctIndex < 4 ? "ABCD"[correctIndex].ToString() : "",
                Explanation = string.IsNullOrWhiteSpace(it.Explanation) ? null : it.Explanation.Trim(),
                RawDifficulty = it.Difficulty?.Trim() ?? "",
                Category = own ? it.Category!.Trim() : d.Category?.Trim() ?? "",
                Subcategory = own ? it.Subcategory?.Trim() ?? "" : d.Subcategory?.Trim() ?? "",
                Subject = own ? it.Subject?.Trim() ?? "" : d.Subject?.Trim() ?? "",
            };
            Validate(row);
            draft.Rows.Add(row);
        }
        return draft;
    }

    private static void Validate(DraftRow row)
    {
        if (row.Error != null) { row.Status = "error"; return; }
        string? error = null;

        if (row.RawDifficulty != "")
        {
            var d = row.RawDifficulty.ToLowerInvariant();
            if (Difficulties.Contains(d)) row.FileDifficulty = d;
            else error = $"difficulty \"{row.RawDifficulty}\" is not easy, medium or hard";
        }

        if (error == null && row.QuestionText == "") error = "question is empty";
        if (error == null)
        {
            var letters = new[] { "a", "b", "c", "d" };
            row.Options = new List<OptionDto>();
            for (var k = 0; k < 4; k++)
                if (row.RawOptions[k] != "") row.Options.Add(new OptionDto(letters[k], row.RawOptions[k]));
            if (row.Options.Count < 2) error = "needs at least 2 options";
        }
        if (error == null)
        {
            var correct = row.RawAnswer == "" ? null
                : ContentEndpoints.MatchCorrect(row.RawAnswer, row.RawOptions[0], row.RawOptions[1], row.RawOptions[2], row.RawOptions[3]);
            if (correct == null || !row.Options.Any(o => o.Id == correct)) error = "correct answer missing or not recognised";
            else row.CorrectId = correct;
        }
        if (error == null && (row.Category == "" || row.Subcategory == ""))
            error = "no category / subcategory (choose a default location or add category columns)";

        row.Error = error;
        row.Status = error == null ? "new" : "error";
    }

    // ---------- difficulty split ----------
    public static void ApplySplit(ImportDraft d)
    {
        foreach (var r in d.Rows)
            r.Difficulty = r.FileDifficulty ?? d.DefaultDifficulty;

        if (d.SplitMode != "split") return;
        var open = d.Rows.Where(r => r.Error == null && r.FileDifficulty == null).ToList();
        d.EasyCount = Math.Clamp(d.EasyCount, 0, open.Count);
        d.MediumCount = Math.Clamp(d.MediumCount, 0, open.Count - d.EasyCount);
        for (var i = 0; i < open.Count; i++)
            open[i].Difficulty = i < d.EasyCount ? "easy" : i < d.EasyCount + d.MediumCount ? "medium" : "hard";
    }

    // ---------- duplicate / update detection ----------
    public static async Task AnnotateAsync(AppDbContext db, ImportDraft d)
    {
        var valid = d.Rows.Where(r => r.Error == null).ToList();
        var cats = valid.Select(r => r.Category).Distinct().ToList();

        var existing = await db.Questions.AsNoTracking()
            .Where(q => cats.Contains(q.Subcategory!.Category!.Name))
            .Select(q => new
            {
                q.Id,
                Cat = q.Subcategory!.Category!.Name,
                Sub = q.Subcategory.Name,
                Subj = q.Subject == null ? "" : q.Subject.Name,
                q.QuestionText,
            }).ToListAsync();

        var byKey = new Dictionary<string, int>();
        foreach (var e in existing) byKey.TryAdd(Key(e.Cat, e.Sub, e.Subj, e.QuestionText), e.Id);

        var qids = valid.Where(r => r.Qid != null).Select(r => r.Qid!.Value).Distinct().ToList();
        var knownIds = qids.Count == 0 ? new HashSet<int>()
            : (await db.Questions.AsNoTracking().Where(q => qids.Contains(q.Id)).Select(q => q.Id).ToListAsync()).ToHashSet();

        var seen = new HashSet<string>();
        foreach (var r in d.Rows)
        {
            r.ExistingId = null;
            if (r.Error != null) { r.Status = "error"; continue; }
            if (r.Qid != null)
            {
                if (knownIds.Contains(r.Qid.Value)) { r.Status = "update"; r.ExistingId = r.Qid; }
                else { r.Status = "error"; r.Error = $"question #{r.Qid} does not exist"; }
                continue;
            }
            var key = Key(r.Category, r.Subcategory, r.Subject, r.QuestionText);
            if (byKey.TryGetValue(key, out var existingId)) { r.Status = "duplicate"; r.ExistingId = existingId; }
            else if (!seen.Add(key)) r.Status = "duplicate";   // repeated inside the same file
            else r.Status = "new";
        }
    }

    // ---------- import ----------
    // dup: "skip" (default) | "update" (overwrite the existing duplicate) | "allow" (add anyway)
    public static async Task<CommitResult> CommitAsync(
        AppDbContext db, ImportDraft d, HashSet<int> selected, string dup, bool shuffle, string adminEmail)
    {
        ApplySplit(d);
        await AnnotateAsync(db, d);

        var batch = new ImportBatch { FileName = d.FileName, AdminEmail = adminEmail };
        db.ImportBatches.Add(batch);
        await db.SaveChangesAsync();

        var result = new CommitResult { BatchId = batch.Id };
        var targets = new Dictionary<string, ContentEndpoints.Target>();
        var rnd = new Random();

        foreach (var r in d.Rows)
        {
            r.SkipReason = null;
            if (r.Status == "error") { r.SkipReason = r.Error; result.Skipped.Add(r); continue; }
            if (!selected.Contains(r.RowNo)) continue; // deliberately unticked: not an error

            var updateId = r.Status == "update" ? r.ExistingId : dup == "update" && r.Status == "duplicate" ? r.ExistingId : null;
            if (r.Status == "duplicate" && (dup == "skip" || (dup == "update" && r.ExistingId == null)))
            {
                r.SkipReason = r.ExistingId != null ? $"duplicate of question #{r.ExistingId}" : "repeated in this file";
                result.Skipped.Add(r);
                continue;
            }

            var tkey = $"{r.Category}|{r.Subcategory}|{r.Subject}".ToLowerInvariant();
            if (!targets.TryGetValue(tkey, out var target))
            {
                target = await ContentEndpoints.Resolve(db, r.Category, r.Subcategory, r.Subject, create: true);
                targets[tkey] = target;
            }
            if (target.Error != null) { r.SkipReason = target.Error; result.Skipped.Add(r); continue; }

            var options = r.Options.Select(o => new OptionDto(o.Id, o.Text)).ToList();
            var correct = r.CorrectId;
            if (shuffle)
            {
                var texts = options.Select(o => (o.Id, o.Text)).OrderBy(_ => rnd.Next()).ToList();
                var letters = new[] { "a", "b", "c", "d" };
                var correctText = options.First(o => o.Id == correct).Text;
                options = texts.Select((t, i) => new OptionDto(letters[i], t.Text)).ToList();
                correct = options.First(o => o.Text == correctText).Id;
            }

            Question? q = null;
            if (updateId != null) q = await db.Questions.FindAsync(updateId.Value);
            var isUpdate = q != null;
            q ??= new Question { ImportBatchId = batch.Id };

            q.SubcategoryId = target.Subcategory!.Id;
            q.SubjectId = target.Subject?.Id;
            q.Difficulty = r.Difficulty;
            q.QuestionText = r.QuestionText;
            q.OptionsJson = JsonSerializer.Serialize(options, Json);
            q.CorrectOptionId = correct;
            q.Explanation = r.Explanation;

            if (isUpdate) result.Updated++;
            else { db.Questions.Add(q); result.Added++; }
        }

        batch.Added = result.Added;
        batch.Updated = result.Updated;
        await db.SaveChangesAsync();
        d.Result = result;
        return result;
    }

    // ---------- spreadsheet rows for download ----------
    public static readonly string[] SheetHeader =
        { "category", "subcategory", "subject", "difficulty", "question", "A", "B", "C", "D", "answer", "explanation" };

    // Rows that were not imported (errors, duplicates) as a sheet you can fix and upload again; the last column explains why.
    public static List<List<string>> ErrorSheet(ImportDraft d)
    {
        var sheet = new List<List<string>> { SheetHeader.Append("reason").ToList() };
        foreach (var r in d.Rows.Where(x => x.SkipReason != null || x.Error != null))
        {
            sheet.Add(new List<string>
            {
                r.Category, r.Subcategory, r.Subject, r.RawDifficulty != "" ? r.RawDifficulty : r.Difficulty,
                r.QuestionText, r.RawOptions[0], r.RawOptions[1], r.RawOptions[2], r.RawOptions[3],
                r.RawAnswer, r.Explanation ?? "", r.SkipReason ?? r.Error ?? "",
            });
        }
        return sheet;
    }

    public static List<List<string>> TemplateSheet() => new()
    {
        new List<string> { "category", "subcategory", "subject", "difficulty", "question", "A", "B", "C", "D", "answer", "explanation" },
        new List<string> { "Tamil Nadu", "Class 6", "Tamil", "easy", "தமிழ்நாட்டின் தலைநகரம்?", "சென்னை", "மதுரை", "கோவை", "சேலம்", "A", "சென்னை தலைநகரம்" },
        new List<string> { "Tamil Nadu", "Class 6", "Mathematics", "", "2 + 2 = ?", "3", "4", "5", "6", "4", "Basic addition" },
        new List<string> { "Indian General Knowledge", "General", "", "hard", "Largest ocean?", "Atlantic", "Pacific", "Indian", "Arctic", "Pacific", "" },
    };
}
