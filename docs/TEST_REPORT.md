# StadiumPulse AI — Test Report

## 2026-07-19 (recovery session baseline)

- Command: `npm run typecheck && npm run lint && npm test && npm run build`
- typecheck: PASS · lint: PASS · build: PASS (74 modules; three chunk 495.65 kB / 124.19 kB gz)
- vitest: 48 passed, 1 skipped (gated live smoke, requires GEMINI_LIVE=1) across 8 files:
  schemas (8), stadium-store (7), routing (12), incident-extraction (9),
  cross-role (1), ai client (3), scenarios (8), live (1 gated).
- Runtime (manual, browser): fan NL request → Vertex Gemini intent + route
  explanation (provenance `gemini`, ~4s); deterministic step-free route
  Gate A → North Elevator → Section 315; Command Center health 94/100; shared
  audit log cross-view. No console errors.

### Known coverage gaps (from QA audit, queued)
- fan-intent.ts: no tests (critical) · health.ts: weak assertions only
- gemini-core rate limiter + repair loop: no tests
- React components incl. WebGL fallback: no tests

## 2026-07-19 (Milestone 7)

- typecheck PASS · lint PASS · build PASS · vitest 55 passed, 1 skipped (9 files;
  +advisories.test.ts with 7 schema-validation tests).
- Runtime (browser): Transport advisory + Sustainability analysis buttons both
  returned live Vertex Gemini output (provenance GEMINI), audit entries logged.
