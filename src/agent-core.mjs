const TEST_COMMAND = /(?:^|[\\/\s])(test|tests|pytest|vitest|jest|mocha|playwright|cargo test|go test)(?:$|\s)/i;
const COMMIT_COMMAND = /\bgit\s+commit\b/i;
const DEPLOY_COMMAND = /\b(deploy|vercel\s+(?:deploy|--prod)|wrangler\s+deploy|fly\s+deploy)\b/i;

function commandText(item) {
  if (typeof item.command === "string") return item.command;
  if (Array.isArray(item.command)) return item.command.join(" ");
  return "";
}

function commandEvent(item) {
  const command = commandText(item);
  const failed = Number(item.exit_code) !== 0 || ["failed", "error"].includes(String(item.status).toLowerCase());

  if (TEST_COMMAND.test(command)) {
    return failed
      ? { type: "test_fail", label: "Test suite failed", intensity: 0.9 }
      : { type: "test_pass", label: "Test suite passed", intensity: 0.78 };
  }
  if (COMMIT_COMMAND.test(command) && !failed) {
    return { type: "commit", label: "Checkpoint committed", intensity: 0.84 };
  }
  if (DEPLOY_COMMAND.test(command)) {
    return failed
      ? { type: "error", label: "Deployment failed", intensity: 1 }
      : { type: "deploy", label: "Deployment completed", intensity: 1 };
  }
  return failed
    ? { type: "error", label: "Command failed", intensity: 0.82 }
    : { type: "typing", label: "Command completed", intensity: 0.42 };
}

export function codexRecordToEvent(record) {
  if (record?.type !== "event_msg") return null;
  const payload = record.payload;

  if (payload?.type === "task_started") {
    return { type: "typing", label: "New Codex turn", intensity: 0.5 };
  }
  if (payload?.type === "task_complete") {
    return { type: "idle", label: "Codex turn completed", intensity: 0.3 };
  }
  if (payload?.type !== "item_completed" || !payload.item) return null;

  const item = payload.item;
  switch (item.type) {
    case "CommandExecution":
      return commandEvent(item);
    case "FileChange": {
      const count = Array.isArray(item.changes) ? item.changes.length : 1;
      const intensity = Math.round(Math.min(0.82, 0.55 + count * 0.06) * 100) / 100;
      return { type: "file", label: `${count} file${count === 1 ? "" : "s"} updated`, intensity };
    }
    case "McpToolCall":
      return ["failed", "error"].includes(String(item.status).toLowerCase())
        ? { type: "error", label: "Connected tool failed", intensity: 0.76 }
        : { type: "typing", label: "Connected tool completed", intensity: 0.46 };
    case "AgentMessage":
      return { type: "idle", label: "Codex response composed", intensity: 0.28 };
    default:
      return null;
  }
}

export function safeRadioEvent(event, style) {
  if (!event) return null;
  return {
    type: event.type,
    label: event.label,
    intensity: event.intensity,
    ...(style ? { style } : {})
  };
}

