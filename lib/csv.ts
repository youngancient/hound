/**
 * CSV for spreadsheets and CRMs. Pure, no imports, unit-tested in
 * tests/csv.test.ts.
 *
 * Some values come from company websites. A cell that starts with = + - @
 * (or a tab / carriage return) can run as a formula when the file is
 * opened in Excel or Google Sheets ("CSV injection"), so those cells are
 * prefixed with an apostrophe, which spreadsheets show as plain text.
 */
export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

export function neutralizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => quote(c.header)).join(",")];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const raw = c.value(row);
          if (raw === null || raw === undefined) return "";
          const text = typeof raw === "number" ? String(raw) : neutralizeCell(raw);
          return quote(text);
        })
        .join(",")
    );
  }
  // Byte-order mark so Excel reads accents and non-Latin names correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
