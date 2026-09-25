import { test } from "node:test";
import assert from "node:assert/strict";
import { applyIcpEdit, changedIcpFields, toIcpEdit } from "../lib/icp-edit.ts";

const houndIcp = {
  target_company_type: "B2B SaaS companies",
  industries: ["Software"],
  geography: ["Canada"],
  headcount_min: 20,
  headcount_max: 200,
  country_codes: ["CA"],
  buyer_persona: "Head of Customer Success",
  business_problem: "Manual customer onboarding",
  hard_filters: ["Company must be headquartered in Canada"],
  soft_preferences: [],
  disqualifiers: ["Agencies and consultancies"],
  assumptions: ["Read 'a lot of customer onboarding' as onboarding-heavy products"],
};

test("toIcpEdit leaves Hound's assumptions out of the editable part", () => {
  const edit = toIcpEdit(houndIcp);
  assert.equal("assumptions" in edit, false);
  assert.equal(edit.target_company_type, "B2B SaaS companies");
});

test("an unchanged edit changes nothing", () => {
  assert.deepEqual(changedIcpFields(houndIcp, toIcpEdit(houndIcp)), []);
});

test("changedIcpFields names each edited field", () => {
  const edit = { ...toIcpEdit(houndIcp), country_codes: ["AU"], headcount_max: 100, soft_preferences: ["Series A or later"] };
  assert.deepEqual(changedIcpFields(houndIcp, edit), ["headcount_max", "country_codes", "soft_preferences"]);
});

test("applyIcpEdit keeps Hound's assumptions, whatever the edit", () => {
  const edit = { ...toIcpEdit(houndIcp), target_company_type: "Fintech startups" };
  const next = applyIcpEdit(houndIcp, edit);
  assert.equal(next.target_company_type, "Fintech startups");
  assert.deepEqual(next.assumptions, houndIcp.assumptions);
});
