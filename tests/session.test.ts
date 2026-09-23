import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../lib/session.ts";

test("safeNextPath keeps same-site paths", () => {
  assert.equal(safeNextPath("/searches/abc"), "/searches/abc");
  assert.equal(safeNextPath("/"), "/");
});

test("safeNextPath refuses anything that could leave the site", () => {
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("/\\evil.example"), "/");
  assert.equal(safeNextPath("javascript:alert(1)"), "/");
  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath(""), "/");
});
