import { test } from "node:test";
import assert from "node:assert/strict";
import { neutralizeCell, toCsv } from "./csv.ts";

test("neutralizeCell stops spreadsheet formulas", () => {
  assert.equal(neutralizeCell("=HYPERLINK(\"http://evil\")"), "'=HYPERLINK(\"http://evil\")");
  assert.equal(neutralizeCell("+1 555"), "'+1 555");
  assert.equal(neutralizeCell("-2"), "'-2");
  assert.equal(neutralizeCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(neutralizeCell("Acme HR"), "Acme HR");
});

test("toCsv quotes commas, quotes and line breaks", () => {
  const csv = toCsv(
    [{ name: 'Acme, "the" HR', body: "Hi\nthere", score: 0.9 }],
    [
      { header: "Company", value: (r) => r.name },
      { header: "Email", value: (r) => r.body },
      { header: "Confidence", value: (r) => r.score },
    ]
  );
  assert.equal(csv, '﻿Company,Email,Confidence\r\n"Acme, ""the"" HR","Hi\nthere",0.9\r\n');
});

test("toCsv leaves empty values empty", () => {
  const csv = toCsv([{ a: null }], [{ header: "A", value: (r) => r.a }]);
  assert.equal(csv, "﻿A\r\n\r\n");
});
