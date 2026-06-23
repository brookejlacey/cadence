# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this project is

Cadence is a real-time AI creative director. It streams a creator's live audio (mic plus shared-tab audio) into Gemini's native-audio model over a bidirectional WebSocket, learns their delivery style, and co-writes scripts in their voice. The defining constraint: the model works on **audio, not transcripts**. Keep that property intact in any change.

## Layout

- `app/main.py`: FastAPI server. Owns the `/ws/{user_id}/{session_id}` WebSocket that bridges the browser to Gemini via Google ADK's `LiveRequestQueue` and `Runner`. Also serves the REST profile API and static files.
- `app/profiles.py`: Per-creator voice-profile persistence (JSON on disk under `app/data/`, gitignored).
- `app/cadence_agents/agent.py`: The Cadence coordinator agent: model, instruction, and tool list.
- `app/cadence_agents/tools/content_analysis.py`: The delivery, hook, and script-annotation tools the agent calls.
- `app/static/`: Vanilla-JS frontend. `js/app.js` is the WebSocket client and UI; the `pcm-*-processor.js` files are AudioWorklet processors that must stay off the main thread.
- `tests/e2e.spec.js`: Playwright end-to-end suite.

## Conventions

- The audio contract is fixed: 16kHz PCM uplink to the model, 24kHz PCM downlink to the browser. Do not change sample rates without updating both the worklets and the server blob mime types.
- Audio chunks carry a one-byte prefix (`0x01` mic, `0x02` tab) so the server can distinguish streams. Preserve it on both ends.
- The BIDI stream is expected to drop. The server heals it by swapping in a fresh `LiveRequestQueue` behind a stable client socket. Keep that retry path intact.
- Keep the frontend dependency-free (no framework, no bundler).

## Running and testing

```bash
pip install -r requirements.txt
cp app/.env.example app/.env   # add GOOGLE_API_KEY
python app/main.py             # serves on :8000

npm install && npx playwright install chromium
npx playwright test            # server must be running
```

The REST endpoints, static serving, and the analysis tools run without a key. The live audio round-trip requires a valid `GOOGLE_API_KEY` with Gemini access.
