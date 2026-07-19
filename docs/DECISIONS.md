# StadiumPulse AI — Decision Record


## D-010: Keep operations panels separate by responsibility

Incident lifecycle controls, health/brief generation, and environment/communication panels live in separate modules behind a small composition root, preserving shared Zustand behavior without prop-drilling.

## D-011: Measure accessibility and coverage with the existing test runner

Vitest uses V8 coverage and axe-core in jsdom. Axe color-contrast checks are excluded in jsdom because layout/color computation is incomplete; contrast, focus and responsive behavior remain part of the real-browser walkthrough.

## D-001: Keep Vite + React SPA, no Next.js
The reference uses Vite; the product is a single-page 3D app with a handful of
serverless endpoints. Vercel serverless functions in `api/` cover the Gemini
backend. Migration to Next.js would add no concrete value.

## D-002: License the whole project PolyForm Noncommercial 1.0.0
The project contains code adapted from a PolyForm NC 1.0.0 work; distributing
under the same terms with the preserved Required Notice is the simplest fully
compliant posture for a noncommercial hackathon entry.

## D-003: Rebuild-with-reference, not copy
The reference is a single 154 KB vanilla-JS `index.html`. We port subsystems
(geometry helpers, arc-length seating, orbit camera, crowd sway, adaptive
quality) into typed React/TS modules, marking each adapted file with an
attribution header. Ticketing/commerce code is not ported.

## D-004: Three.js from npm (modern), not r128 CDN
Modern three requires `colorSpace`/`outputColorSpace` instead of the removed
`encoding`/`outputEncoding` APIs (5 sites identified in reference). Adaptation
happens during the port. No GSAP: camera transitions reimplemented with
rAF-based easing to drop a dependency the new codebase doesn't otherwise need.

## D-005: Deterministic core, generative rim
Routing (Dijkstra over a typed graph), health score, thresholds, state
transitions, ids and timestamps are deterministic TypeScript. Gemini only
interprets language, extracts structure, explains, and drafts announcements —
always behind Zod validation with deterministic fallbacks and provenance
labels (`gemini` | `fallback` | `fixture`).

## D-006: High-risk human approval enforced in the store, not the UI
`reportIncident` forcibly sets `requiresHumanApproval` for high-risk
categories; `resolveIncident` refuses resolution without an operator decision.
Announcements cannot publish without prior approval. Enforcement lives in the
store so no UI path or AI output can bypass it.

## D-007: Scenario engine supplies snapshots; store restores them
`restoreBaseline(snapshot)` guarantees scenario reset restores a consistent
initial state, avoiding drift from incremental undo.

## D-008: Share endpoint routing and API error contracts across runtimes

The frontend client, Vite development bridge, Vercel functions and Cloud Run
server consume one endpoint/task registry. Server-generated failures use one
typed `{ ok: false, error: string }` contract, preventing runtime drift while
leaving successful AI behavior unchanged.

## D-009: Accessible status is part of the component contract

Async results use polite live regions, validation failures use alerts, decorative
emoji are hidden from assistive technology, and the visual crowd-heat layer has
a textual per-zone representation. Native HTML semantics remain preferred.
