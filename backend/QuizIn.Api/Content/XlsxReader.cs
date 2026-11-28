using System.IO.Compression;
using System.Xml.Linq;

namespace QuizIn.Api.Content;

// Minimal .xlsx reader (no extra NuGet package): an .xlsx file is a zip of XML files.
// Reads the FIRST worksheet and returns every row as a list of cell texts (column A first).
public static class XlsxReader
{
    // XML namespaces used inside an .xlsx file. Every element name must be written with its namespace, e.g. Main + "row".
    private static readonly XNamespace Main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace RelNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace PkgRel = "http://schemas.openxmlformats.org/package/2006/relationships";
    // Safety limit: refuse an XML file inside the zip that is larger than 100 MB (protects against "zip bomb" uploads).
    private const long MaxEntryBytes = 100_000_000;

    // Main method. Used by Admin/ImportService.cs for .xlsx uploads. Steps: open the zip -> find the first sheet file ->
    // read the shared strings table -> go through every row and cell. Missing cells become empty strings so columns stay aligned.
    public static List<List<string>> ReadFirstSheet(Stream stream)
    {
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);

        var sheetPath = FirstSheetPath(zip);
        var shared = ReadSharedStrings(zip);
        var sheet = Load(zip, sheetPath) ?? throw new InvalidDataException("Worksheet not found");

        var rows = new List<List<string>>();
        foreach (var rowElement in sheet.Descendants(Main + "row"))
        {
            var cells = new List<string>();
            foreach (var c in rowElement.Elements(Main + "c"))
            {
                var index = ColumnIndex((string?)c.Attribute("r"), cells.Count);
                while (cells.Count < index) cells.Add("");
                cells.Add(CellText(c, shared).Trim());
            }
            rows.Add(cells);
        }
        return rows;
    }

    // Gets the text of one cell. t="s" means the value is an index into the shared strings table; t="inlineStr" has the text inside the cell.
    private static string CellText(XElement c, List<string> shared)
    {
        var type = (string?)c.Attribute("t");
        if (type == "s")
        {
            var raw = (string?)c.Element(Main + "v");
            return int.TryParse(raw, out var i) && i >= 0 && i < shared.Count ? shared[i] : "";
        }
        if (type == "inlineStr")
            return string.Concat(c.Descendants(Main + "t").Select(t => t.Value));
        return (string?)c.Element(Main + "v") ?? ""; // numbers, formula text, booleans
    }

    // Opens one XML file from inside the zip. Returns null when it does not exist.
    private static XDocument? Load(ZipArchive zip, string path)
    {
        var entry = zip.GetEntry(path);
        if (entry == null) return null;
        if (entry.Length > MaxEntryBytes) throw new InvalidDataException("File too large");
        using var s = entry.Open();
        return XDocument.Load(s);
    }

    // Finds which XML file holds the first worksheet by reading xl/workbook.xml and its relationships.
    // Falls back to the usual name xl/worksheets/sheet1.xml.
    private static string FirstSheetPath(ZipArchive zip)
    {
        var workbook = Load(zip, "xl/workbook.xml");
        var relId = (string?)workbook?.Descendants(Main + "sheet").FirstOrDefault()?.Attribute(RelNs + "id");
        var rels = Load(zip, "xl/_rels/workbook.xml.rels");
        if (relId != null && rels != null)
        {
            var target = rels.Descendants(PkgRel + "Relationship")
                .FirstOrDefault(r => (string?)r.Attribute("Id") == relId)?.Attribute("Target")?.Value;
            if (target != null)
            {
                target = target.TrimStart('/');
                return target.StartsWith("xl/") ? target : "xl/" + target;
            }
        }
        return "xl/worksheets/sheet1.xml";
    }

    // Excel stores every distinct text once in xl/sharedStrings.xml; cells point to it by number.
    private static List<string> ReadSharedStrings(ZipArchive zip)
    {
        var doc = Load(zip, "xl/sharedStrings.xml");
        if (doc == null) return new List<string>();
        return doc.Descendants(Main + "si")
            .Select(si => string.Concat(si.Descendants(Main + "t")
                .Where(t => t.Parent?.Name != Main + "rPh")   // skip phonetic hints
                .Select(t => t.Value)))
            .ToList();
    }

    // "B3" -> 1 (zero based). Falls back to the next free column when there is no reference.
    private static int ColumnIndex(string? reference, int fallback)
    {
        if (string.IsNullOrEmpty(reference)) return fallback;
        var n = 0;
        var any = false;
        foreach (var ch in reference)
        {
            if (ch < 'A' || ch > 'Z') break;
            n = n * 26 + (ch - 'A' + 1);
            any = true;
        }
        return any ? n - 1 : fallback;
    }
}
