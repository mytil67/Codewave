import { watchFile, unwatchFile } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { codexRecordToEvent, safeRadioEvent } from "../src/agent-core.mjs";

const args = process.argv.slice(2);
const valueAfter = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const stationUrl = (valueAfter("--url") || process.env.CODEWAVE_URL || "http://localhost:8787").replace(/\/$/, "");
const explicitSession = valueAfter("--session");
const style = valueAfter("--style");
const token = process.env.CODEWAVE_INGEST_TOKEN || "";
const sessionsRoot = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "sessions");

async function findJsonlFiles(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await findJsonlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) results.push(path);
  }
  return results;
}

async function newestSession() {
  const files = await findJsonlFiles(sessionsRoot);
  const dated = await Promise.all(files.map(async path => ({ path, mtime: (await stat(path)).mtimeMs })));
  dated.sort((a, b) => b.mtime - a.mtime);
  if (!dated[0]) throw new Error(`No Codex session found in ${sessionsRoot}`);
  return dated[0].path;
}

async function send(event) {
  const safe = safeRadioEvent(event, style);
  const response = await fetch(`${stationUrl}/api/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(safe)
  });
  if (!response.ok) throw new Error(`Station returned HTTP ${response.status}`);
  console.log(`${new Date().toLocaleTimeString()}  ${safe.type.padEnd(10)} ${safe.label}`);
}

const sessionPath = explicitSession ? resolve(explicitSession) : await newestSession();
const initial = await stat(sessionPath);
let offset = initial.size;
let pendingSize = initial.size;
let buffer = "";
let reading = false;

try {
  const health = await fetch(`${stationUrl}/api/health`);
  if (!health.ok) throw new Error(`Station returned HTTP ${health.status}`);
} catch (error) {
  console.error(`Cannot reach Codewave at ${stationUrl}: ${error.message}`);
  console.error("Start it first with: npm start");
  process.exit(1);
}

console.log(`Codewave agent is listening to ${basename(sessionPath)}`);
console.log("Only anonymized musical events leave this computer. Press Ctrl+C to stop.");

async function readNewRecords() {
  if (reading || pendingSize <= offset) return;
  reading = true;
  try {
    while (pendingSize > offset) {
      const targetSize = pendingSize;
      const handle = await open(sessionPath, "r");
      const length = targetSize - offset;
      const bytes = Buffer.alloc(length);
      await handle.read(bytes, 0, length, offset);
      await handle.close();
      offset = targetSize;
      const lines = (buffer + bytes.toString("utf8")).split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = codexRecordToEvent(JSON.parse(line));
          if (event) await send(event);
        } catch (error) {
          console.error(`Skipped one session record: ${error.message}`);
        }
      }
    }
  } finally {
    reading = false;
  }
}

watchFile(sessionPath, { interval: 400 }, (current, previous) => {
  if (current.size < previous.size) {
    offset = 0;
    buffer = "";
  }
  pendingSize = current.size;
  void readNewRecords();
});

process.on("SIGINT", () => {
  unwatchFile(sessionPath);
  console.log("\nCodewave agent stopped.");
  process.exit(0);
});

