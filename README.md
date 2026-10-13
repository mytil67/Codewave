# Codewave

**Your coding sessions, broadcast as an endless retro-futuristic radio.**

Codewave turns safe, anonymized development events into synthwave, chiptune, FM synth and Italo disco. The server distributes a live musical score; each listener's browser synthesizes it with the Web Audio API.

This first MVP intentionally has no native audio engine, database, dependency or external service. It runs anywhere Node.js runs. Docker is optional, not the main installation path.

## Quick start

Requirements: Node.js 20 or newer.

```bash
npm start
```

Open <http://localhost:8787>, press **Start listening**, then launch the demo feed in a second terminal:

```bash
npm run demo
```

Or use Docker:

```bash
docker compose up --build
```

## Listen to a real Codex session

Start the station:

```bash
npm start
```

In a second terminal, start the local agent:

```bash
npm run agent
```

The agent automatically follows the most recently modified Codex JSONL session. It starts at the end of the file, so old activity is not replayed. Keep coding and the new events will appear on the radio.

The desktop session file is treated as a best-effort adapter source rather than a stable public API. Unknown record types are ignored safely, so a future Codex format change should degrade quietly instead of leaking content or crashing the station.

Options:

```bash
npm run agent -- --style chiptune
npm run agent -- --url https://your-codewave.example
npm run agent -- --session /path/to/rollout-session.jsonl
```

Use the `CODEWAVE_URL` environment variable instead of `--url` if preferred. Authentication uses `CODEWAVE_INGEST_TOKEN`; tokens are never accepted as command-line arguments, where they could appear in process listings.

## Send a coding event

Only send metadata. Never send source code, prompts, terminal output, file contents or secrets.

```bash
curl -X POST http://localhost:8787/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"test_pass","label":"42 tests passed","intensity":0.8,"style":"chiptune"}'
```

Supported event types are `typing`, `file`, `test_pass`, `test_fail`, `error`, `commit`, `deploy` and `idle`. Styles are `synthwave`, `chiptune`, `fm` and `italo`. Intensity is clamped between `0` and `1`.

Set `CODEWAVE_INGEST_TOKEN` to protect ingestion. Clients must then send `Authorization: Bearer <token>`.

## Architecture

```text
Coding tools / adapters
        │  safe events only
        ▼
POST /api/events ── Node.js station ── SSE /api/events
                                           │
                                           ▼
                                Web Audio synthesizer
```

The current radio is event-synchronized rather than sample-synchronized: every listener hears the same style and reacts to the same coding events, while the exact notes may vary slightly between clients. A future broadcast mode can render server-side audio and publish it to Icecast.

## Roadmap

- Adapters for Claude Code, Cursor, Git and test runners
- Deterministic, time-synchronized musical score for every listener
- Richer synthesis, drums, transitions and musical scenes
- Optional server-side renderer with Icecast/HLS broadcasting
- Session history and shareable station pages

## Privacy model

Codewave should know that a test failed, not what the code or error message contained. Adapters must reduce local activity to the small event schema before sending anything over the network.

## License

License not chosen yet.
