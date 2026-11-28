using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QuizIn.Api.Content;
using QuizIn.Api.Data;
using QuizIn.Api.Models;

namespace QuizIn.Api.Admin;

// ===================================================================================================
// BULK IMPORT PIPELINE (used by the import pages in AdminControllers.cs):
//   1. READ FILE      : the controller reads Excel/CSV into List<List<string>> (or takes JSON text).
//   2. MAP COLUMNS    : BuildFromTable finds columns by header name (see Aliases). BuildFromJson reads JSON fields.
//   3. VALIDATE ROWS  : Validate() checks every row and sets row.Error when something is wrong.
//   4. SPLIT          : ApplySplit() sets the final difficulty of each row (file value, default, or easy/medium/hard split).
//   5. PREVIEW        : AnnotateAsync() marks each row new / duplicate / update / error. The admin sees this in the preview page.
//   6. COMMIT         : CommitAsync() saves the ticked rows, creates an ImportBatch, so the whole import can be undone by ImportBatchId.
// The draft (ImportDraft) is kept between preview and commit by the controller (IMemoryCache, key = Token).
// ===================================================================================================

/// <summary>
/// One parsed spreadsheet / JSON row waiting in the import preview.
/// Raw* fields are the text as typed in the file. The other fields are the cleaned values after validation.
/// </summary>
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
    public string? ExistingWhere { get; set; }        // where the existing duplicate lives
    public string? SkipReason { get; set; }           // filled in on import
    public string CorrectId { get; set; } = "";
    public List<OptionDto> Options { get; set; } = new();
}

/// <summary>
/// Result of a commit: the new ImportBatch id (used for undo), counts of added / updated questions,
/// and the rows that were skipped (each with a SkipReason).
/// </summary>
public class CommitResult
{
    public int BatchId { get; set; }
    public int Added { get; set; }
    public int Updated { get; set; }
    public List<DraftRow> Skipped { get; set; } = new();
}

/// <summary>
/// A whole uploaded file after parsing: all rows plus the import settings the admin chose.
/// Token identifies it in the cache between the preview step and the commit step.
/// EasyCount / MediumCount are used by the "split" difficulty mode (the rest become hard).
/// </summary>
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

/// <summary>
/// Defaults chosen on the import form. They are used for rows that have no category columns
/// or no difficulty of their own.
/// </summary>
public record ImportDefaults(string? Category, string? Subcategory, string? Subject, string Difficulty);

/// <summary>
/// All import logic (parse, validate, duplicate check, save). Static and has no state, so it is easy to test.
/// </summary>
public static class ImportService
{
    // Safety limit: one file cannot have more rows than this.
    public const int MaxRows = 5000;
    // The only difficulty values we accept.
    private static readonly string[] Difficulties = { "easy", "medium", "hard" };
    // JSON settings (camelCase names) used for the options column and for JSON import.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Header names we accept -> the internal column key. Add a new alias here if a header is not recognised.
    // Keys are written after Norm() (lower case, only letters and digits), so "Question Text" matches "questiontext".
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

    // Simplifies a header name for matching with Aliases: trim, lower case, keep letters and digits only.
    private static string Norm(string s) => new string(s.Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
    // Duplicate key: the question text only, ignoring case, spaces and punctuation, so "What is 2+2?" and "what is 2 + 2"
    // match. Letters, digits and combining marks are kept (Tamil vowel signs are combining marks).
    internal static string NormText(string s)
    {
        var sb = new System.Text.StringBuilder(s.Length);
        var lastSpace = true;
        foreach (var ch in s)
        {
            var cat = char.GetUnicodeCategory(ch);
            var keep = char.IsLetterOrDigit(ch)
                || cat == System.Globalization.UnicodeCategory.NonSpacingMark
                || cat == System.Globalization.UnicodeCategory.SpacingCombiningMark
                || cat == System.Globalization.UnicodeCategory.EnclosingMark;
            if (keep) { sb.Append(char.ToLowerInvariant(ch)); lastSpace = false; }
            else if (!lastSpace) { sb.Append(' '); lastSpace = true; }
        }
        return sb.ToString().Trim();
    }

    // ---------- parsing ----------
    // STAGES 2 + 3 for Excel/CSV: map header columns, then validate each row.
    // Returns null and sets "error" when the whole file is unusable (empty, no questions, too many rows).
    // Spreadsheet / CSV. With a header row, columns are found by name (category, subcategory, subject, difficulty, question,
    // A-D, answer, explanation, qid). Without one the old layout is used: id, question, A, B, C, D, answer, explanation.
    public static ImportDraft? BuildFromTable(List<List<string>> all, ImportDefaults d, string fileName, out string? error)
    {
        error = null;
        // Remember the original row number (for messages), then drop rows where every cell is empty.
        var rows = all.Select((r, i) => (cells: r, no: i + 1)).Where(x => x.cells.Any(c => c != "")).ToList();
        if (rows.Count == 0) { error = "The file is empty."; return null; }

        // map: column key (e.g. "question") -> column index. Built from the first row if it looks like a header.
        var map = new Dictionary<string, int>();
        var first = rows[0].cells;
        for (var i = 0; i < first.Count; i++)
            if (Aliases.TryGetValue(Norm(first[i]), out var key) && !map.ContainsKey(key)) map[key] = i;

        // It is a header row only if it has a "question" or "answer" column.
        var hasHeader = map.ContainsKey("question") || map.ContainsKey("answer");
        // No header: use the old fixed layout (column 0 = id is ignored).
        if (!hasHeader)
            map = new Dictionary<string, int> { ["question"] = 1, ["a"] = 2, ["b"] = 3, ["c"] = 4, ["d"] = 5, ["answer"] = 6, ["explanation"] = 7 };

        var data = hasHeader ? rows.Skip(1).ToList() : rows;
        if (data.Count == 0) { error = "The file has a header row but no questions."; return null; }
        if (data.Count > MaxRows) { error = $"Too many rows ({data.Count}). Import at most {MaxRows} per file."; return null; }

        // Local helper: read a cell by column key. Returns "" if the column or cell is missing.
        string Get(List<string> r, string key) => map.TryGetValue(key, out var i) && i < r.Count ? r[i].Trim() : "";

        // One DraftRow per data line. Errors are stored on the row, not thrown, so the preview can show them.
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

            // Optional qid column (from an export): the row will UPDATE that question instead of adding a new one.
            var qid = Get(cells, "qid");
            if (qid != "")
            {
                if (int.TryParse(qid, out var parsed) && parsed > 0) row.Qid = parsed;
                else row.Error = "qid must be a number";
            }
            // Check the row now. Duplicate check comes later in AnnotateAsync.
            Validate(row);
            draft.Rows.Add(row);
        }
        return draft;
    }

    // STAGES 2 + 3 for JSON input: same result as BuildFromTable, but the data comes from a JSON array.
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
            // JSON gives the correct option by id, but the draft stores a letter. Find its position (0-3) -> "A".."D".
            var correctIndex = opts.FindIndex(o => o.Id == it.CorrectOptionId);

            // "own" = the item has its own category, so use its location; otherwise use the form defaults.
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

    // STAGE 3: row validation. Stops at the FIRST problem and saves it in row.Error (shown in the preview).
    // Rules, in order: difficulty valid -> question not empty -> at least 2 options -> correct answer found -> category set.
    // On success it fills row.FileDifficulty, row.Options and row.CorrectId.
    private static void Validate(DraftRow row)
    {
        // An error from an earlier step (for example a bad qid) is kept.
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
            // Empty option cells are dropped; ids stay a/b/c/d by column position.
            var letters = new[] { "a", "b", "c", "d" };
            row.Options = new List<OptionDto>();
            for (var k = 0; k < 4; k++)
                if (row.RawOptions[k] != "") row.Options.Add(new OptionDto(letters[k], row.RawOptions[k]));
            if (row.Options.Count < 2) error = "needs at least 2 options";
        }
        if (error == null)
        {
            // The answer can be a letter (A-D), a number or the option text. MatchCorrect (ContentEndpoints) turns it into an option id.
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
    // STAGE 4: sets row.Difficulty for every row.
    //  - A difficulty written in the file always wins.
    //  - Otherwise the default difficulty is used ("single" mode).
    //  - In "split" mode the open rows (valid, no difficulty in file) are cut in file order:
    //    first EasyCount rows = easy, next MediumCount rows = medium, all the rest = hard.
    public static void ApplySplit(ImportDraft d)
    {
        foreach (var r in d.Rows)
            r.Difficulty = r.FileDifficulty ?? d.DefaultDifficulty;

        if (d.SplitMode != "split") return;
        var open = d.Rows.Where(r => r.Error == null && r.FileDifficulty == null).ToList();
        // Clamp so the counts can never be negative or bigger than the number of rows.
        d.EasyCount = Math.Clamp(d.EasyCount, 0, open.Count);
        d.MediumCount = Math.Clamp(d.MediumCount, 0, open.Count - d.EasyCount);
        for (var i = 0; i < open.Count; i++)
            open[i].Difficulty = i < d.EasyCount ? "easy" : i < d.EasyCount + d.MediumCount ? "medium" : "hard";
    }

    // ---------- duplicate / update detection ----------
    // STAGE 5 (preview): sets row.Status for every row, by comparing with the database.
    //   error     = failed validation (or qid does not exist)
    //   update    = row has a qid of an existing question -> will overwrite it
    //   duplicate = same question text already in the database (or repeated earlier in this same file)
    //   new       = safe to add
    // Called again inside CommitAsync so the status is fresh at save time.
    public static async Task AnnotateAsync(AppDbContext db, ImportDraft d)
    {
        var valid = d.Rows.Where(r => r.Error == null).ToList();

        // A question is a duplicate when the same text exists ANYWHERE (any category, class or subject).
        var existing = await db.Questions.AsNoTracking()
            .Select(q => new
            {
                q.Id,
                Cat = q.Subcategory!.Category!.Name,
                Sub = q.Subcategory.Name,
                Subj = q.Subject == null ? "" : q.Subject.Name,
                q.QuestionText,
            }).ToListAsync();

        // Lookup: normalised question text -> (existing question id, readable location). TryAdd keeps the first match.
        var byKey = new Dictionary<string, (int Id, string Where)>();
        foreach (var e in existing)
            byKey.TryAdd(NormText(e.QuestionText), (e.Id, e.Cat + " › " + e.Sub + (e.Subj != "" ? " › " + e.Subj : "")));

        // Check which qids from the file really exist (one query, not one per row).
        var qids = valid.Where(r => r.Qid != null).Select(r => r.Qid!.Value).Distinct().ToList();
        var knownIds = qids.Count == 0 ? new HashSet<int>()
            : (await db.Questions.AsNoTracking().Where(q => qids.Contains(q.Id)).Select(q => q.Id).ToListAsync()).ToHashSet();

        // "seen" holds keys already used earlier in this file, to catch repeats inside the file.
        var seen = new HashSet<string>();
        foreach (var r in d.Rows)
        {
            r.ExistingId = null;
            r.ExistingWhere = null;
            if (r.Error != null) { r.Status = "error"; continue; }
            if (r.Qid != null)
            {
                if (knownIds.Contains(r.Qid.Value)) { r.Status = "update"; r.ExistingId = r.Qid; }
                else { r.Status = "error"; r.Error = $"question #{r.Qid} does not exist"; }
                continue;
            }
            var key = NormText(r.QuestionText);
            if (byKey.TryGetValue(key, out var hit)) { r.Status = "duplicate"; r.ExistingId = hit.Id; r.ExistingWhere = hit.Where; }
            else if (!seen.Add(key)) r.Status = "duplicate";   // repeated inside the same file
            else r.Status = "new";
        }
    }

    // ---------- import ----------
    // STAGE 6 (commit): saves the rows the admin ticked in the preview.
    //  - "selected" = row numbers (RowNo) that were ticked.
    //  - Creates an ImportBatch first; every NEW question gets ImportBatchId = batch.Id, which is how "undo import" finds them.
    //    (Updated questions keep their old batch id, so undo does not delete them.)
    //  - "shuffle" randomises the order of the options and moves the correct answer with them.
    //  - Rows that cannot be saved are returned in result.Skipped with a reason.
    // dup: "skip" (default) | "update" (overwrite the existing duplicate) | "allow" (add anyway)
    public static async Task<CommitResult> CommitAsync(
        AppDbContext db, ImportDraft d, HashSet<int> selected, string dup, bool shuffle, string adminEmail)
    {
        // Recalculate difficulty and status, because the data may have changed since the preview.
        ApplySplit(d);
        await AnnotateAsync(db, d);

        // Save the batch first so we get its Id.
        var batch = new ImportBatch { FileName = d.FileName, AdminEmail = adminEmail };
        db.ImportBatches.Add(batch);
        await db.SaveChangesAsync();

        var result = new CommitResult { BatchId = batch.Id };
        // Cache of category/subcategory/subject lookups, so the same location is resolved only once per import.
        var targets = new Dictionary<string, ContentEndpoints.Target>();
        var rnd = new Random();

        foreach (var r in d.Rows)
        {
            r.SkipReason = null;
            if (r.Status == "error") { r.SkipReason = r.Error; result.Skipped.Add(r); continue; }
            if (!selected.Contains(r.RowNo)) continue; // deliberately unticked: not an error

            // updateId = id of the question to overwrite, or null to add a new one.
            // Duplicate policy: skip = ignore duplicates, update = overwrite the existing one, allow = add anyway.
            var updateId = r.Status == "update" ? r.ExistingId : dup == "update" && r.Status == "duplicate" ? r.ExistingId : null;
            if (r.Status == "duplicate" && (dup == "skip" || (dup == "update" && r.ExistingId == null)))
            {
                r.SkipReason = r.ExistingId != null ? $"duplicate of question #{r.ExistingId} ({r.ExistingWhere})" : "repeated in this file";
                result.Skipped.Add(r);
                continue;
            }

            // Find (or create, create: true) the category, subcategory and subject for this row.
            var tkey = $"{r.Category}|{r.Subcategory}|{r.Subject}".ToLowerInvariant();
            if (!targets.TryGetValue(tkey, out var target))
            {
                target = await ContentEndpoints.Resolve(db, r.Category, r.Subcategory, r.Subject, create: true);
                targets[tkey] = target;
            }
            if (target.Error != null) { r.SkipReason = target.Error; result.Skipped.Add(r); continue; }

            // Copy the options so shuffling does not change the draft row.
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

            // Load the existing question for an update, or start a new one tagged with this batch id (for undo).
            Question? q = null;
            if (updateId != null) q = await db.Questions.FindAsync(updateId.Value);
            var isUpdate = q != null;
            q ??= new Question { ImportBatchId = batch.Id };

            // Copy all values into the entity. Options are stored as JSON text in OptionsJson.
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

        // Save the counts on the batch and write everything to the database in one SaveChanges.
        batch.Added = result.Added;
        batch.Updated = result.Updated;
        await db.SaveChangesAsync();
        d.Result = result;
        return result;
    }

    // ---------- spreadsheet rows for download ----------
    // Column order of the download sheets. Same names as Aliases, so a downloaded sheet can be uploaded again.
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

    // Example file the admin can download: header row plus 3 sample questions (Tamil, maths without difficulty, hard GK).
    public static List<List<string>> TemplateSheet() => new()
    {
        new List<string> { "category", "subcategory", "subject", "difficulty", "question", "A", "B", "C", "D", "answer", "explanation" },
        new List<string> { "Tamil Nadu", "Class 6", "Tamil", "easy", "தமிழ்நாட்டின் தலைநகரம்?", "சென்னை", "மதுரை", "கோவை", "சேலம்", "A", "சென்னை தலைநகரம்" },
        new List<string> { "Tamil Nadu", "Class 6", "Mathematics", "", "2 + 2 = ?", "3", "4", "5", "6", "4", "Basic addition" },
        new List<string> { "Indian General Knowledge", "General", "", "hard", "Largest ocean?", "Atlantic", "Pacific", "Indian", "Arctic", "Pacific", "" },
    };
}
