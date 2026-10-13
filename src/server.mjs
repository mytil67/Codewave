import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeEvent, publicState } from "./core.mjs";

const root = fileURLToPath(new URL("../public", import.meta.url));
const port = Number(process.env.PORT || 8787);
const ingestToken = process.env.CODEWAVE_INGEST_TOKEN || "";
const clients = new Set();
const state = {
  stationStartedAt: new Date().toISOString(),
  style: "synthwave",
  energy: 0.42,
  listeners: 0,
  recentEvents: []
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) client.write(message);
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("Payload too large");
  }
  return JSON.parse(raw || "{}");
}

function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    return false;
  }
  response.writeHead(200, {
    "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "cache-control": "no-cache"
  });
  createReadStream(filePath).pipe(response);
  return true;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json(response, 200, { ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    return json(response, 200, publicState(state));
  }

  if (request.method === "GET" && url.pathname === "/api/events") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    response.write(`event: state\ndata: ${JSON.stringify(publicState(state))}\n\n`);
    clients.add(response);
    state.listeners = clients.size;
    broadcast("listeners", { listeners: state.listeners });
    request.on("close", () => {
      clients.delete(response);
      state.listeners = clients.size;
      broadcast("listeners", { listeners: state.listeners });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/events") {
    if (ingestToken && request.headers.authorization !== `Bearer ${ingestToken}`) {
      return json(response, 401, { error: "Invalid ingest token" });
    }
    try {
      const event = normalizeEvent(await readJson(request));
      if (event.style) state.style = event.style;
      state.energy = Math.round((state.energy * 0.65 + event.intensity * 0.35) * 100) / 100;
      state.recentEvents.push(event);
      state.recentEvents = state.recentEvents.slice(-40);
      broadcast("codewave", { event, state: publicState(state) });
      return json(response, 202, event);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  }

  if (request.method === "GET" && serveStatic(url.pathname, response)) return;
  json(response, 404, { error: "Not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Codewave is live on http://localhost:${port}`);
});

