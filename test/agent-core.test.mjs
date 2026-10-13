import test from "node:test";
import assert from "node:assert/strict";
import { codexRecordToEvent, safeRadioEvent } from "../src/agent-core.mjs";

function completed(item) {
  return { type: "event_msg", payload: { type: "item_completed", item } };
}

test("maps test commands without exposing the command", () => {
  const secret = "npm test -- --token=super-secret";
  const event = codexRecordToEvent(completed({ type: "CommandExecution", command: secret, exit_code: 0, status: "completed" }));
  assert.deepEqual(event, { type: "test_pass", label: "Test suite passed", intensity: 0.78 });
  assert.doesNotMatch(JSON.stringify(safeRadioEvent(event)), /super-secret/);
});

test("maps file changes to counts, never paths or patches", () => {
  const event = codexRecordToEvent(completed({
    type: "FileChange",
    changes: [{ path: "private/customer-list.txt", diff: "very sensitive" }],
    status: "completed"
  }));
  assert.deepEqual(event, { type: "file", label: "1 file updated", intensity: 0.61 });
  assert.doesNotMatch(JSON.stringify(event), /customer|sensitive/);
});

test("ignores messages and reasoning payloads that may contain session text", () => {
  assert.equal(codexRecordToEvent({ type: "response_item", payload: { type: "message", content: "secret" } }), null);
  assert.equal(codexRecordToEvent(completed({ type: "Reasoning", raw_content: "secret" })), null);
});

test("maps lifecycle events", () => {
  assert.equal(codexRecordToEvent({ type: "event_msg", payload: { type: "task_started" } }).label, "New Codex turn");
  assert.equal(codexRecordToEvent({ type: "event_msg", payload: { type: "task_complete" } }).type, "idle");
});

