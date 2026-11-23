using System.IO.Compression;
using System.Text;

namespace QuizIn.Api.Content;

// Minimal dependency-free .xlsx writer: one sheet of text cells (inline strings). Enough for exports,
// the error report and the import template. Excel, LibreOffice and Google Sheets open the result.
public static class XlsxWriter
{
    public static byte[] Write(List<List<string>> rows, string sheetName = "Questions")
    {
        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            Add(zip, "[Content_Types].xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
                "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>" +
                "</Types>");

            Add(zip, "_rels/.rels",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                "</Relationships>");

            Add(zip, "xl/workbook.xml",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
                "<sheets><sheet name=\"" + Escape(sheetName) + "\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");

            Add(zip, "xl/_rels/workbook.xml.rels",
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>" +
                "</Relationships>");

            var sheet = new StringBuilder();
            sheet.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sheet.Append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
            for (var r = 0; r < rows.Count; r++)
            {
                sheet.Append("<row r=\"").Append(r + 1).Append("\">");
                for (var c = 0; c < rows[r].Count; c++)
                {
                    var value = rows[r][c];
                    if (string.IsNullOrEmpty(value)) continue;
                    sheet.Append("<c r=\"").Append(ColumnName(c)).Append(r + 1).Append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                         .Append(Escape(value)).Append("</t></is></c>");
                }
                sheet.Append("</row>");
            }
            sheet.Append("</sheetData></worksheet>");
            Add(zip, "xl/worksheets/sheet1.xml", sheet.ToString());
        }
        return ms.ToArray();
    }

    private static void Add(ZipArchive zip, string name, string content)
    {
        var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
        using var stream = entry.Open();
        var bytes = new UTF8Encoding(false).GetBytes(content);
        stream.Write(bytes, 0, bytes.Length);
    }

    private static string ColumnName(int index)
    {
        var name = "";
        for (var n = index + 1; n > 0; n = (n - 1) / 26) name = (char)('A' + (n - 1) % 26) + name;
        return name;
    }

    // XML 1.0 forbids most control characters, so they are dropped.
    private static string Escape(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
        {
            if (ch == '\t' || ch == '\n' || ch == '\r' || (ch >= 0x20 && ch != 0xFFFE && ch != 0xFFFF && !(ch >= 0xD800 && ch <= 0xDFFF)))
            {
                switch (ch)
                {
                    case '&': sb.Append("&amp;"); break;
                    case '<': sb.Append("&lt;"); break;
                    case '>': sb.Append("&gt;"); break;
                    case '"': sb.Append("&quot;"); break;
                    default: sb.Append(ch); break;
                }
            }
            else if (char.IsSurrogate(ch)) sb.Append(ch); // keep emoji / rare scripts
        }
        return sb.ToString();
    }
}
