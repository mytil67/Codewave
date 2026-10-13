import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEvent, publicState } from "../src/core.mjs";

test("normalizes untrusted events and clamps intensity", () => {
  const event = normalizeEvent({ type: "unknown", intensity: 4, label: "hello\nworld" });
  assert.equal(event.type, "typing");
  assert.equal(event.intensity, 1);
  assert.equal(event.label, "hello world");
  assert.ok(event.id);
});

test("public state only exposes the latest events", () => {
  const recentEvents = Array.from({ length: 20 }, (_, id) => ({ id }));
  const result = publicState({
    stationStartedAt: "now",
    style: "fm",
    energy: 0.5,
    listeners: 2,
    recentEvents
  });
  assert.equal(result.recentEvents.length, 12);
  assert.equal(result.recentEvents[0].id, 8);
});

