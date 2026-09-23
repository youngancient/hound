import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimitWaitMs, trimWords } from "../lib/scrape-text.ts";

test("rateLimitWaitMs reads Firecrawl's retry hint, capped", () => {
  const firecrawl = new Error("Rate limit exceeded. Consumed (req/min): 12, Remaining (req/min): 0. ... please retry after 13s, resets at ...");
  assert.equal(rateLimitWaitMs(firecrawl), 14_000);
  assert.equal(rateLimitWaitMs(new Error("Rate limit exceeded, retry after 120s")), 30_000);
  assert.equal(rateLimitWaitMs(new Error("Rate limit exceeded")), 16_000);
  assert.equal(rateLimitWaitMs(new Error('DNS resolution failed for hostname "x.com"')), null);
});

test("trimWords keeps the start of the page and its line breaks", () => {
  assert.deepEqual(trimWords("one two\nthree four five", 3), { text: "one two\nthree", trimmed: true });
  assert.deepEqual(trimWords("short page", 3), { text: "short page", trimmed: false });
  assert.deepEqual(trimWords("", 3), { text: "", trimmed: false });
});
