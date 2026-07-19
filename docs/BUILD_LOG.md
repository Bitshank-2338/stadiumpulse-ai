# StadiumPulse AI — Build Log

## Milestone 0 — Reference and Licence Audit ✅ (2026-07-19)

- Cloned reference repo (read-only) to `reference-football-stadium/`.
- Read LICENSE.md (PolyForm NC 1.0.0 + Required Notice), COMMERCIAL-LICENSE.md, THIRD_PARTY_NOTICES.md.
- Key discovery: entire reference app is a single 154 KB `index.html` (vanilla JS, Three.js r128 + GSAP via CDN); `src/` is an unused starter stub.
- Repository Archaeologist (Haiku) delivered architecture map — verified by orchestrator grep, ACCEPTED.
- Product & UX Analyst (Haiku) delivered journeys/criteria/demo script — ACCEPTED WITH TRIMS (see AGENT_LOG entry 002).

## Milestone 1 — New Project Foundation ✅ (2026-07-19)

- Scaffolded Vite 6 + React 19 + TypeScript strict (with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Dependencies: three (npm), zustand, zod; dev: vitest, RTL, eslint 9 flat config + typescript-eslint.
- Created legal backbone: `LICENSE.md` (PolyForm NC 1.0.0 + preserved Required Notice), `ATTRIBUTION.md` (adapted vs original code breakdown).
- Authored shared domain types (`src/types/domain.ts`) — spatial graph, incidents, routing, preferences, transport, sustainability, announcements, scenarios, audit, AI status, health.
- Authored authoritative Zustand store (`src/store/stadium-store.ts`) with incident lifecycle, human-approval enforcement for high-risk categories, announcement approve-before-publish gate, audit logging on every action.
- Adapted `mulberry32` seeded RNG from reference (attributed in-file).
- Design tokens (`src/styles/theme.css`): dark control-room theme, cyan accents, high-contrast + reduced-motion modes, persistent disclaimer style.
- Validation: `typecheck` ✅, `lint` ✅, `test` 7/7 ✅, `build` ✅.

## Milestone 2 — Stadium Digital Twin (visual foundation) ✅ (2026-07-19)

- Three.js Specialist agent was write-blocked by the environment permission layer; orchestrator performed the port directly (see AGENT_LOG entry 003).
- Ported to typed modules under `src/scene/` with attribution headers:
  `geometry.ts` (ringStrip/canvasTexture/merge), `seating.ts` (arcTable/thetaAt
  elliptical arc-length layout, single InstancedMesh, ~9k seats, reference tier
  dimensions preserved as world-scale contract), `bowl.ts` (tiers, roof, glass,
  pitch, floodlights — dark cyan control-room palette), `crowd.ts` (instanced
  torsos/heads, onBeforeCompile sway shader, reduced-motion freeze),
  `quality.ts` (FPS-adaptive pixel ratio), `stadium-scene.ts` (custom smoothed
  spherical orbit + pinch/wheel/keyboard, rAF loop, no GSAP).
- Modern three API: `outputColorSpace`/`texture.colorSpace` (r128 `encoding` removed).
- Original overlay APIs for operations: `setMarkers`, `setRoutePath` (tube along
  Catmull-Rom), `setZoneHeat` (green→red discs) — store-driven later.
- React wrapper `src/components/stadium-canvas.tsx`: mount-once, ResizeObserver,
  loading state, WebGL-failure text fallback, lazy-loaded (own chunk).

## Milestone 3 — Deterministic Domain Engine ✅ (2026-07-19)

- `src/data/stadium-graph.ts`: 41-node typed graph (6 gates, dual concourse
  rings, 4 seating entrances, 2 elevators/stairs/escalators, 13 facilities,
  metro + shuttle exits) in scene world coordinates.
- `src/domain/routing.ts`: Dijkstra with mode- and preference-aware edge
  filtering/costs (step-free, avoid stairs/escalators, least-crowded,
  reduced-sensory, emergency), elevator-outage awareness, explained failures
  with assistance-desk fallback, facility ranking.
- `src/domain/health.ts`: weighted deterministic health breakdown.
- `src/domain/scenarios.ts`: all 9 scenarios as reproducible state packages
  applied via store actions; baseline snapshot reset.
- Fixed during verify: scenario seeded a zone id (`gate-b-concourse`) instead of
  node id (`concourse-b`) — caught by graph-integrity test.
- Validation: `typecheck` ✅, `lint` ✅, `test` 27/27 ✅, `build` ✅.

## Milestone 4 (core) — Fan & Accessibility Experience ✅ (2026-07-19)

- Fan Companion: origin select, 10 functional quick actions, NL requests via
  deterministic intent interpreter (`src/domain/fan-intent.ts` — doubles as the
  no-key fallback for M6), route card (distance/ETA/congestion/step-free),
  explained failures with assistance-desk fallback button, emergency requests
  feed the shared incident queue.
- Accessibility panel: 11 preferences; wheelchair/step-free force accessible
  routing in every mode; high-contrast + reduced-motion drive theme attributes.
- Scenario Lab wired to the scenario engine with live health badge.
- Store→scene selectors: incident/outage/facility markers, crowd-heat discs,
  route polyline (accessible routes violet).
- Verify-loop fixes: strict type-predicate errors in selectors (rewritten with
  typed accumulation), unused import.

## Milestone 5 — Volunteer & Operations Workflow ✅ (2026-07-19)

- `src/domain/incident-extraction.ts`: rule-based NL→IncidentExtraction
  fallback (12 category rules, location/people detection, conservative
  low-confidence 'other'), duplicate guard (same category+location while
  unresolved).
- `src/domain/announcements.ts`: deterministic EN/ES/FR/HI announcement
  templates per incident category.
- Volunteer Reporter: NL report, 6 category shortcuts, simulated voice
  transcript, location hint, structured preview (category/severity/location/
  impacts/team/actions/confidence/missing info/human-review), confirm-before-
  submit, duplicate submission blocked, recent-reports list.
- Operations Command Center: health breakdown (6 badges), incident queue with
  acknowledge/assign/approve-reject-per-action/note/resolve/reopen (resolve
  refusals explained), announcement center (draft→approve→publish gate),
  environment panel (outages/transport/waste), audit log (last 30, mono).
- Cross-role integration test mirrors the 19-step judge demo at store level:
  fan step-free route → volunteer report → surge scenario → health drop →
  operator approval → 4-language announcement publish → elevator-outage
  reroute via south elevator → resolve → baseline recovery → audit trail.
- Validation: `typecheck` ✅, `lint` ✅, `test` 37/37 ✅, `build` ✅.

## Milestone 6 — Gemini Integration ✅ code / ⚠ live quota (2026-07-19)

- SDK: `@google/genai` 2.12.0 (API verified against installed d.ts — GoogleGenAI
  → models.generateContent → response.text, abortSignal supported).
- `src/ai/config.ts`: central config — default model `gemini-2.5-flash-lite`
  (cheap tier, GEMINI_MODEL overridable), 12s timeout, 1 repair attempt,
  temp 0.3, 1024 max tokens, server rate limit 8 req/min + 1.5s min interval.
- `src/ai/schemas.ts`: all seven required Zod schemas + route-explanation,
  shared client/server; task registry.
- `api/_lib/gemini-core.ts` (server-only): prompt-injection defence
  (<untrusted_input> delimiting + strict system rules), stadium-graph
  grounding (valid location ids listed), sliding-window rate limiter,
  JSON parse → Zod validate → one repair prompt → structured error.
- Endpoints: `api/gemini/{incident,fan-guidance,situation-brief,announcement}.ts`
  via shared handler factory; Vite dev middleware serves the same core locally.
  Key read from process.env only — never bundled.
- `src/ai/client.ts`: frontend caller — timeout, Zod re-validation, provenance
  tracking, aiStatus store updates, audit entry on every fallback.
- UI wiring: volunteer extraction, fan intent + route explanation, ops
  situation brief + announcement drafting — all provenance-badged
  (Gemini cyan / fallback grey); header AI status chip with latency.
- Tests: schema validation (8), client fallback behaviour (3 — network down,
  invalid data, valid response), gated live smoke test.
- Live smoke: pipeline reached Google successfully; account returned
  429 RESOURCE_EXHAUSTED (prepayment credits depleted) — key/billing issue on
  the user side. Fallback engaged correctly. Awaiting a funded/free-tier key.
- Validation: `typecheck` ✅, `lint` ✅, `test` 48/48 ✅ (+1 gated live).

## Recovery Session — State Reconstruction (2026-07-19 evening)

- New orchestrator session (Claude Fable 5) reconstructed project state from the
  repository; previous chat context unavailable.
- 4 read-only audit agents (archaeology, QA, 3D, GenAI security) + orchestrator
  verification. Full findings in docs/CONTINUATION_STATE.md.
- Baseline validation: typecheck ✅, lint ✅, test 48/48 ✅ (live test gated),
  build ✅.
- Live browser check: fan step-free request answered by real Vertex Gemini
  (4.0s, provenance badge), deterministic elevator route rendered, audit log
  synchronized across views. Vertex ADC path confirmed working locally.
- Milestone verdict: M0–M6 and M8 VERIFIED COMPLETE; M7 PARTIAL (3 AI tasks
  unwired: transport-advisory, sustainability-recommendation,
  accessibility-explanation); M9/11/12 not started.
- Resuming at Milestone 7.

## Milestone 7 — Transport, Sustainability & Accessible-Route AI ✅ (2026-07-19)

- Sonnet worker implemented under orchestrator review; type-safety fix
  (AuditAction union extended, casts removed) applied by orchestrator.
- `src/ai/client.ts`: +3 wrappers — transportAdvisory,
  sustainabilityRecommendation, explainAccessibleRoute.
- `src/domain/advisories.ts` (new): deterministic fallbacks branching on
  metro status and waste fill; 7 schema-validation tests.
- Command Center Environment panel: "Transport advisory" + "Sustainability
  analysis" buttons, provenance-badged cards, audit entries
  (transport_advisory_generated / sustainability_recommendation_generated).
- Fan Companion: accessible routes (wheelchair/step-free prefs or step_free
  mode) now use accessibility-explanation task with step-by-step fallback.
- Security hardening: prompt context now wrapped in <app_state> tags with
  marker stripping + SHARED_RULES sentence (closes audit finding).
- Validation: typecheck ✅, lint ✅, test 55/55 ✅, build ✅.
- Runtime verified in browser: both buttons returned live Vertex Gemini
  results with GEMINI badges and audit-log entries.

## Milestones 9–11 (partial) — Audit, Hardening, Submission Material (2026-07-19)

- M9 responsive/a11y audit: all 6 views checked at 375px mobile viewport —
  no horizontal overflow (nav is an intentional scrollable tab bar), no touch
  targets under 32px, zero unlabeled controls, correct heading hierarchy.
  Reduced-motion/high-contrast and ARIA'd WebGL fallback verified earlier.
- M10 priority tests (Sonnet worker + orchestrator review): fan-intent.test.ts
  (22 tests) and health.test.ts (16 tests, incl. hand-computed baseline 94).
- Worker found 2 real fan-intent fallback bugs; orchestrator fixed root cause:
  emergency rule now runs before facility rules (was shadowed by /medic/ for
  "medical emergency") and matches "need help"/"help me" (was: "I need help"
  → unknown). Documenting tests converted to regression tests.
- M11: root README.md created (product statement, architecture, ADC-first
  credential setup, Cloud Run deployment note, 19-step demo script,
  limitations, PolyForm NC attribution).
- Validation: typecheck ✅, lint ✅, test 93/93 ✅, build ✅.
