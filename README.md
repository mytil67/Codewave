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

## Musical engine

The browser schedules audio ahead of time on a sixteenth-note grid for stable timing. Each style defines its own tempo, scale, multiple chord progressions and synth palette. A sixteen-bar form moves through Drift, Groove, Lift and Breakdown sections, with deterministic chord inversions, rests, bass variations, melodic motifs and fills. Session energy changes the arrangement density across pads, bass, drums, arpeggios and lead lines. Important events add an accent on the next beat instead of interrupting the music abruptly.

The conductor remembers musical context across events. Errors create tension that decays over several bars, green tests resolve it, commits rotate the recurring motif, file changes alter harmonic color, and deployments trigger a four-bar climax. FM uses carrier/modulator synthesis, while Synthwave and Italo voices use subtle detuning for width.

The sound engine gives pads, basses, plucks, leads and accents their own multi-oscillator voice architecture in every style. Filter envelopes, stereo placement, vibrato and style-specific FM operators feed a master chain with chorus, tempo delay, convolution reverb, soft saturation and compression. Drums combine synthesized bodies with filtered noise instead of relying on bare clicks.

Synthwave uses custom band-limited analog waves, wide detuned pads, a rounded sub-supported bass and a darker, lower, less frequent arpeggio. Its chorus and dotted-eighth delay are intentionally stronger, while hats and snares are softened to keep the mix warm rather than arcade-like.

**Focus Mix** is enabled by default. It softens high frequencies, reduces percussion and melodic density, and smooths envelopes. It can be toggled at any time, and the master volume is always available beside the play control.

Stopping playback closes the current Web Audio context so scheduled notes cannot return on the next start. Codewave also keeps only one local browser tab playing at a time: starting the station in another tab automatically stops the first one.

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
