/**
 * CSV out — the serialiser behind every Reports **Export** (#21/#66).
 *
 * "Export" is the only word for CSV out (#66); "back up" and "Sync" are retired.
 * Kept pure and apart from `reports.ts` for the reason `display.ts` is: nothing
 * here touches the database, and it is the piece whose output has to stay byte
 * stable so a spreadsheet re-imports the same columns every time — which is what
 * the golden-file tests in `reports.test.ts` guard.
 *
 * RFC 4180 shape, no dependency: fields are comma-separated, rows are joined
 * with CRLF, and a field carrying a comma, a double quote or a newline is
 * wrapped in double quotes with its own quotes doubled. A `null` or `undefined`
 * cell is an empty field, never the word — a report row hands this numbers,
 * booleans and nulls straight from a query.
 *
 * Rows may be ragged on purpose: a person sheet is a sheet, not one table, and
 * its sections have different widths.
 */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(field).join(",")).join("\r\n");
}

function field(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
