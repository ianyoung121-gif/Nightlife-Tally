import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMON_BAR_DRINKS, getCurrentSpecialChoices, isSpinChoiceCurrent } from "../src/drink-spin.ts";

const now = new Date(2026, 9, 12, 12).getTime();
const owner = (changes = {}) => ({
  id: 1, barId: 42, title: "Happy hour", description: "$5 cocktails",
  validUntil: null, createdAt: "2026-10-10T12:00:00Z", ...changes,
});
const checked = (changes = {}) => ({
  id: 1, barId: 42, title: "Happy hour", description: "$4 draft beers",
  sourceUrl: "https://example.com/specials", checkedAt: "2026-10-11T12:00:00Z",
  expiresAt: new Date(now + 60_000).toISOString(), ...changes,
});

test("20 unique common suggestions are usable without any venue or network data", () => {
  assert.equal(COMMON_BAR_DRINKS.length, 20);
  assert.equal(new Set(COMMON_BAR_DRINKS.map((d) => d.id)).size, 20);
  assert.equal(new Set(COMMON_BAR_DRINKS.map((d) => d.name)).size, 20);
  for (const drink of COMMON_BAR_DRINKS) {
    assert.equal(drink.kind, "common-drink");
    assert.ok(drink.description);
    assert.equal(drink.barId, undefined);
    assert.equal(drink.sourceUrl, undefined);
  }
});

test("specials are an independent pool, never a fallback to catalog drinks", () => {
  assert.deepEqual(getCurrentSpecialChoices([], [], now), []);
});

test("expired, invalid, and blank specials are excluded", () => {
  assert.deepEqual(getCurrentSpecialChoices([
    owner({ validUntil: new Date(now - 1).toISOString() }),
    owner({ validUntil: "not a date" }),
    owner({ validUntil: "2026-02-30" }),
    owner({ title: " " }),
  ], [
    checked({ expiresAt: new Date(now).toISOString() }),
    checked({ expiresAt: "" }),
    checked({ expiresAt: "not a date" }),
    checked({ title: " " }),
  ], now), []);
});

test("owner date-only specials remain eligible through the local calendar day", () => {
  assert.equal(getCurrentSpecialChoices([owner({ validUntil: "2026-10-12" })], [], now).length, 1);
  assert.equal(getCurrentSpecialChoices([owner({ validUntil: "2026-10-11" })], [], now).length, 0);
  assert.equal(getCurrentSpecialChoices([owner({ validUntil: "2026-10-12" })], [], new Date(2026, 9, 13).getTime()).length, 0);
});

test("ongoing specials and checked offers retain their own identity and source", () => {
  const picks = getCurrentSpecialChoices([owner()], [checked()], now);
  assert.equal(picks.length, 2);
  assert.notEqual(picks[0].id, picks[1].id);
  assert.equal(picks[0].barId, 42);
  assert.equal(picks[0].kind, "owner-special");
  assert.equal(picks[1].kind, "checked-special");
  assert.equal(picks[1].sourceUrl, "https://example.com/specials");
  assert.equal(picks[1].checkedAt, "2026-10-11T12:00:00Z");
  assert.equal(picks[1].expiresAt, new Date(now + 60_000).toISOString());
});

test("checked Google offers keep their Place ID without pretending to be owner-linked", () => {
  const [pick] = getCurrentSpecialChoices([], [checked({ barId: null, providerId: "google-place-id" })], now);
  assert.equal(pick.providerId, "google-place-id");
  assert.equal(pick.barId, undefined);
});

test("an offer that expires during a spin cannot become the final suggestion", () => {
  const [pick] = getCurrentSpecialChoices([], [checked()], now);
  assert.equal(isSpinChoiceCurrent(pick, now), true);
  assert.equal(isSpinChoiceCurrent(pick, now + 60_000), false);
  assert.equal(isSpinChoiceCurrent(COMMON_BAR_DRINKS[0], now + 60_000), true);
});
