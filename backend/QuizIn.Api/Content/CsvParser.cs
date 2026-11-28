using System.Text;

namespace QuizIn.Api.Content;

/// <summary>Reads CSV text into rows of cells (used by the bulk import, Admin/ImportService.cs). No library needed.</summary>
public static class CsvParser
{
    // Handles quoted commas, "" escaped quotes, multi-line cells, \r\n and a UTF-8 BOM.
    // Returns one List<string> per row. Works as a small state machine: inQuotes = true while inside a "quoted" cell,
    // where commas and line breaks are normal text. A doubled quote ("") inside quotes means one quote character.
    public static List<List<string>> Parse(string text)
    {
        text = text.TrimStart('﻿');
        var rows = new List<List<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        // Walk the text one character at a time.
        var inQuotes = false;

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                    else inQuotes = false;
                }
                else cell.Append(c);
            }
            else if (c == '"') inQuotes = true;
            else if (c == ',') { row.Add(cell.ToString()); cell.Clear(); }
            else if (c == '\n' || c == '\r')
            {
                if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                row.Add(cell.ToString());
                cell.Clear();
                rows.Add(row);
                row = new List<string>();
            }
            else cell.Append(c);
        }

        // The file may not end with a line break: save the last row.
        if (cell.Length > 0 || row.Count > 0)
        {
            row.Add(cell.ToString());
            rows.Add(row);
        }
        return rows;
    }
}
