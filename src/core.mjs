export const EVENT_TYPES = new Set([
  "typing",
  "file",
  "test_pass",
  "test_fail",
  "error",
  "commit",
  "deploy",
  "idle"
]);

const STYLE_NAMES = new Set(["synthwave", "chiptune", "fm", "italo"]);

export function normalizeEvent(input = {}) {
  const type = EVENT_TYPES.has(input.type) ? input.type : "typing";
  const intensity = Number.isFinite(Number(input.intensity))
    ? Math.min(1, Math.max(0, Number(input.intensity)))
    : 0.5;
  const style = STYLE_NAMES.has(input.style) ? input.style : undefined;

  return {
    id: crypto.randomUUID(),
    type,
    intensity,
    ...(style ? { style } : {}),
    // Labels are deliberately short: raw source code must never enter the radio.
    label: String(input.label ?? type).replace(/[\r\n\t]/g, " ").slice(0, 80),
    timestamp: new Date().toISOString()
  };
}

export function publicState(state) {
  return {
    stationStartedAt: state.stationStartedAt,
    style: state.style,
    energy: state.energy,
    listeners: state.listeners,
    recentEvents: state.recentEvents.slice(-12)
  };
}

