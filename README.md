# StadiumPulse AI

**One operational event is understood once — and becomes the right guidance for
everyone.** A live 3D stadium digital twin where fans, accessibility users,
volunteers, and venue operators all act on the same shared operational state,
with Gemini (via Vertex AI) interpreting language and drafting communications
while deterministic TypeScript owns every decision that matters.

Built for **PromptWars** — GenAI for stadium operations and tournament
experience (navigation, crowd management, accessibility, transportation,
sustainability, multilingual assistance, operational intelligence, real-time
decision support).

> Independent prototype. Not affiliated with or endorsed by FIFA. All venue,
> match and operational data is simulated.

## What it does

Six connected experiences over **one authoritative Zustand store** — never six
separate demos:

| View | What it does |
|---|---|
| **Digital Twin** | Instanced Three.js stadium (~13.8k seats, animated crowd) with live incident markers, crowd heat, outages, and route polylines. Adaptive quality, reduced-motion support, honest WebGL fallback. |
| **Fan Companion** | Natural-language requests ("Take me to Section 315 without stairs") → Gemini intent interpretation → deterministic Dijkstra route in the twin, with AI route explanation and published announcements feed. |
| **Accessibility** | 11 preferences (wheelchair, step-free, reduced sensory, high contrast, reduced motion…) that reshape routing costs and the UI itself. Elevator outages reroute automatically. |
| **Volunteer Reporter** | Free-text/voice-style incident reports → Gemini structured extraction (Zod-validated) → operator queue. Duplicate guard, confidence and missing-info surfaced, confirm-before-submit. |
| **Operations Command Center** | Stadium health breakdown, incident lifecycle with **enforced human approval** for high-risk actions, 4-language (EN/ES/FR/HI) announcement draft → approve → publish gate, transport & sustainability AI advisories, full audit log. |
| **Scenario Lab** | 9 reproducible operational scenarios (gate surge, elevator outage, metro overload, heat advisory…) that propagate through health, routes, markers, and every role's view. Snapshot-based reset. |

## Architecture in one paragraph

Deterministic core, generative rim. Routing (Dijkstra over a 41-node typed
graph), health scoring, thresholds, incident state machines, IDs, timestamps,
and human-approval gates are plain TypeScript — enforced in the store so no UI
path or AI output can bypass them. Gemini only interprets language, extracts
structure, explains, and drafts communications; every AI call is Zod-validated
on both server and client, rate-limited, prompt-injection-hardened
(`<untrusted_input>`/`<app_state>` delimiting), and backed by a deterministic
fallback with visible provenance (`Gemini` / `fallback` badges) plus an audit
entry whenever the fallback engages. No credential ever reaches the browser.

```
Browser (React 19 + Zustand + Three.js)
   └─ src/ai/client.ts ── POST /api/gemini/* (no secrets client-side)
        └─ api/_lib/gemini-core.ts ── @google/genai
             ├─ Vertex AI (ADC)  ← GOOGLE_GENAI_USE_VERTEXAI=true
             └─ Gemini API key   ← fallback path
```

## Running it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Without any AI credentials the app runs fully — every AI feature degrades to
its deterministic fallback, labeled honestly in the UI.

### Enabling Gemini via Vertex AI (recommended)

```bash
gcloud auth application-default login
```

Then create `.env`:

```
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<your-project>
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-2.5-flash   # optional
```

An AI Studio `GEMINI_API_KEY` also works as an alternative. Credentials are
read server-side only (dev-server middleware locally, serverless functions in
production) and are never bundled.

> **Deployment note:** Vertex ADC resolves automatically on Google-hosted
> runtimes (Cloud Run recommended). On Vercel, only the API-key path works —
> ADC has no metadata server there.

### Validation

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Demo script (the 19-step judge flow)

1. Fan asks for a step-free route to Section 315 → elevator route appears in
   the twin. 2. Volunteer reports a Gate B crowd blockage → Gemini extracts a
structured incident. 3. Operator acknowledges; Gate B crowd state, 3D markers,
and stadium health react; affected routes recalculate. 4. Operator approves the
Gate D redirection, drafts a 4-language announcement, approves and publishes
it. 5. The Fan Companion receives it and the fan's route changes. 6. An
elevator outage (Scenario Lab) forces the accessible route through the south
elevator. 7. Operator resolves incidents → health recovers → the audit log
preserves the entire sequence. Every step is shared-state-driven — nothing is
scripted.

## Documentation

- [docs/BUILD_LOG.md](docs/BUILD_LOG.md) — milestone-by-milestone build history
- [docs/DECISIONS.md](docs/DECISIONS.md) — architecture decision record
- [docs/CONTINUATION_STATE.md](docs/CONTINUATION_STATE.md) — verified project state
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md) — validation results

## Known limitations

- Single-client state (no backend persistence/realtime sync) — by design for a
  hackathon prototype; the store is the seam where a realtime backend would go.
- Vertex ADC requires a Google-hosted runtime for deployed AI (see note above).
- The in-memory AI rate limiter is per-instance, not distributed.
- Stadium layout and all operational data are simulated.

## License & attribution

**PolyForm Noncommercial 1.0.0.** The 3D stadium adapts code from
[football-stadium](https://github.com/thebuggeddev/football-stadium) by
thebuggeddev — see [ATTRIBUTION.md](ATTRIBUTION.md) and [LICENSE.md](LICENSE.md).
Required Notice: Copyright 2026 thebuggeddev. Contact: <thebuggeddev@gmail.com>.
Creator: <https://x.com/thebuggeddev>.
