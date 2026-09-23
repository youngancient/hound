import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime, formatDuration, formatRelative } from "./time.ts";

test("formatDuration uses the 2min14s style", () => {
  assert.equal(formatDuration(45_000), "45s");
  assert.equal(formatDuration(134_000), "2min14s");
  assert.equal(formatDuration(180_000), "3min0s");
  assert.equal(formatDuration(3_785_000), "1h3min5s");
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(-5_000), "0s");
  assert.equal(formatDuration(1_999), "1s");
});

test("formatRelative reads naturally, then falls back to a date", () => {
  const now = new Date("2026-09-23T14:30:00Z");
  assert.equal(formatRelative(new Date("2026-09-23T14:29:30Z"), now, "UTC"), "just now");
  assert.equal(formatRelative(new Date("2026-09-23T14:25:00Z"), now, "UTC"), "5min ago");
  assert.equal(formatRelative(new Date("2026-09-23T12:30:00Z"), now, "UTC"), "2h ago");
  assert.equal(formatRelative(new Date("2026-09-20T09:05:00Z"), now, "UTC"), "Sep 20, 09:05");
});

test("formatDateTime adds the year only for other years", () => {
  const now = new Date("2026-09-23T14:30:00Z");
  assert.equal(formatDateTime(new Date("2026-09-23T14:05:00Z"), now, "UTC"), "Sep 23, 14:05");
  assert.equal(formatDateTime(new Date("2025-12-31T23:00:00Z"), now, "UTC"), "Dec 31, 2025, 23:00");
});
