# StadiumPulse AI — Continuation State

> Handoff source of truth for any future session. Append; do not rewrite history.

## Session: Recovery audit (2026-07-19, evening)

- **Branch:** `master`, working tree clean at session start (only this docs/ update + `.claude/launch.json` added since).
- **Last commits:** `3c1cea0` Switch AI backend to Vertex AI mode · `6b65fdc` M6 Gemini integration · `f58ce8c` M5 · `6b928bb` M4 · `812e22e` M2+3 · `32529af` M0+1.
- **Recovery method:** 4 read-only audit agents (archaeology, QA, 3D, GenAI security) + orchestrator verification + full baseline validation + live browser runtime check.

## Architecture summary

Vite 6 + React 19 + TS strict SPA. Zustand store (`src/store/stadium-store.ts`) is the single authority; selectors (`src/store/selectors.ts`) drive the Three.js twin (`src/scene/*`, instanced seats ~13.8k, crowd sway shader, adaptive pixel ratio, full dispose chain — no leaks found). Deterministic domain engine (`src/domain/*`): Dijkstra routing over 41-node graph, health score, 9 scenarios, incident extraction fallback, EN/ES/FR/HI announcement templates. AI rim: browser → `src/ai/client.ts` → `/api/gemini/*` (Vercel-style functions + identical Vite dev bridge) → `api/_lib/gemini-core.ts` → `@google/genai` (Vertex ADC when `GOOGLE_GENAI_USE_VERTEXAI=true`, else API-key path). Zod validation both sides, 1 repair attempt, rate limiter, provenance (`gemini`/`fallback`) surfaced in UI.

## Baseline validation (2026-07-19)

- `typecheck` ✅ · `lint` ✅ · `test` 48/48 ✅ (1 gated live test correctly skipped) · `build` ✅ (three chunk 124 KB gz).
- **Live runtime (browser, dev server):** app loads clean (no console errors); fan step-free request → real Vertex Gemini response ("AI: Gemini 4043ms", GEMINI provenance badge) → deterministic elevator route + AI explanation; Command Center health 94/100; audit log captured the fan action cross-view. WebGL canvas mounted (screenshot capture in the tool timed out — visual pixel check not completed; ARIA + console clean).

## Milestone matrix (authoritative)

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Reference/licence audit | VERIFIED COMPLETE (attribution headers in all 6 adapted scene files, LICENSE.md + ATTRIBUTION.md, PolyForm NC notice preserved) |
| 1 | Foundation | VERIFIED COMPLETE |
| 2 | Stadium digital twin | VERIFIED COMPLETE (store→scene fully wired; minor dead API: `focusOn`, `topDown`) |
| 3 | Deterministic domain engine | VERIFIED COMPLETE |
| 4 | Fan + accessibility experience | VERIFIED COMPLETE |
| 5 | Volunteer + operations workflow | VERIFIED COMPLETE (draft→approve→publish gate enforced in store; fan receives published announcements) |
| 6 | Gemini/Vertex integration | VERIFIED COMPLETE (live Vertex verified locally this session) |
| 7 | Announcements/transport/sustainability | **PARTIAL — current milestone.** Announcements done. `transport-advisory`, `sustainability-recommendation`, `accessibility-explanation` have schemas+prompts+endpoints but NO client wrapper or UI call site (`src/ai/client.ts` exposes only 5 of 8 tasks) |
| 8 | Full scenario integration | VERIFIED COMPLETE (all 9 scenarios wired to store + 3D markers) |
| 9 | Responsive + accessibility audit | NOT STARTED (no evidence) |
| 10 | Production hardening | PARTIAL (see gaps below) |
| 11 | Submission material | NOT STARTED — **no root README.md**, no demo/deploy docs |
| 12 | Judge review | NOT STARTED |

## Accepted audit findings (gaps to work)

1. **M7 (next):** wire `transportAdvisory` + `sustainabilityRecommendation` client wrappers with deterministic fallbacks + Command Center environment-panel buttons; wire or remove `accessibility-explanation`.
2. **Security should-fix:** `context` in `gemini-core.ts` prompt is labeled "trusted" but accepts `unknown` from the HTTP body without delimiting — narrow or delimit it.
3. **Deployment mismatch (decision needed):** Vertex ADC will NOT resolve on Vercel serverless. Options: Cloud Run (org-policy aligned), Workload Identity Federation, or keep local-dev-only demo. No code change made yet.
4. **Test gaps (M9/10):** fan-intent parser (0 tests), health formula (weak), rate limiter + repair loop (0), component tests incl. WebGL fallback (0).
5. **3D minor:** marker geometry allocated per `setMarkers` call (pool if churn grows); no WebGL context-loss recovery.
6. **Housekeeping:** `.env` contains a `GEMINI_API_KEY` value (gitignored, never committed) despite org no-API-key policy — recommend user removes/rotates it; Vertex vars are also present and take precedence.

## Files that must not be carelessly rewritten

`src/store/stadium-store.ts` (approval gates live here), `src/domain/routing.ts`, `src/scene/*` (attribution headers), `api/_lib/gemini-core.ts`, `LICENSE.md`, `ATTRIBUTION.md`, `.gitignore`.

## Inherited decisions still binding

D-001…D-007 in docs/DECISIONS.md (Vite SPA, PolyForm NC, rebuild-not-copy, npm three, deterministic core / generative rim, store-enforced human approval, snapshot-based scenario reset).

## Next actions (exact)

1. M7: add the two client wrappers + deterministic fallbacks (`src/domain/` — transport advisory + sustainability recommendation) + Command Center buttons with provenance badges; decide accessibility-explanation (wire on accessible-route computation).
2. Harden `context` handling in `gemini-core.ts` (delimit or schema-narrow).
3. M9: responsive/mobile + a11y pass. M10: priority tests (fan-intent, health). M11: README + demo script + deploy decision (Cloud Run recommended).

---

## Update — end of recovery session (2026-07-19, late evening)

Commits this session: `b431e7a` (M7 + ledger), `3091ce1` (M9/10 tests + fan-intent
emergency fix + README), `afc0054` (fan-intent mode rules + live demo verification).

Milestone matrix changes: **M7 VERIFIED COMPLETE** (all 8 AI tasks wired, live-
verified). **M9 VERIFIED** (mobile/a11y spot audit passed, all 6 views). **M10
substantially advanced** (93/93 tests; fan-intent + health now covered; two real
fan-intent bugs fixed with regressions). **M11 started** (README.md complete).
**M12 prep done** (full judge flow manually verified against live Vertex Gemini,
including the elevator-outage South Elevator reroute).

Open items for next session:
1. **Deployment decision (user):** Cloud Run (ADC-native, org-aligned) vs Vercel
   (API-key path only). No code change made; local ADC dev verified working.
2. **User housekeeping:** remove/rotate the GEMINI_API_KEY in local `.env`.
3. Optional hardening: rate-limiter/repair-loop tests, component tests, WebGL
   context-loss recovery, marker geometry pooling, narrow `context` schema
   server-side (app_state delimiting is done).
4. M11 remainder: submission packaging per PromptWars requirements (screenshots/
   video if required by the submission form).

## Update — Cloud Run deployment (2026-07-19, night)

Deployed: **https://stadiumpulse-ai-1030864030501.asia-south1.run.app**
(service stadiumpulse-ai, asia-south1, project fifa-502907). ADC via default
compute SA with roles/aiplatform.user; no keys. New files: server/index.ts,
Dockerfile, .dockerignore. Redeploy with the same `gcloud run deploy` command
in BUILD_LOG. Deployment decision resolved: Option A (Cloud Run).
## Code-quality and accessibility completion pass (2026-07-19)

- Recovered the interrupted Worker A/B/C changes without replacing existing work.
- Worker A completed: one shared endpoint/task registry now drives the frontend,
  Vite bridge, Vercel handlers and Cloud Run server; all server entry points use
  the same typed error body; AI client context types are task-specific; unused
  scene APIs were removed after consumer searches.
- Worker B verified: one `main` landmark, view-heading focus management, visible
  canvas focus treatment, and corrected normal/high-contrast borders.
- Worker C completed: shared provenance badge adopted at all intended call sites;
  Command Center decomposed into six cohesive child components; repeated layout
  styles moved to utilities; live/status and blank-submit feedback added;
  decorative emoji hidden; crowd heat has a per-zone text equivalent.
- Validation: typecheck, lint, 95 tests, production build, and six-view mobile
  browser pass. The live Gemini test remains intentionally gated by credentials.
- Graphify semantic graph generation was unavailable because no supported
  graphify LLM credential was configured; source-level dependency searches were
  used for the final integration audit.
