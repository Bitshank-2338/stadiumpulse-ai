# Attribution

StadiumPulse AI is derived in part from the **StadiView / football-stadium**
reference project:

- Repository: <https://github.com/thebuggeddev/football-stadium>
- Live demo: <https://football-stadium-ruddy.vercel.app/>
- Author: thebuggeddev (<thebuggeddev@gmail.com>, <https://x.com/thebuggeddev>)
- Licence: PolyForm Noncommercial License 1.0.0
- Required Notice: Copyright 2026 thebuggeddev. Contact: <thebuggeddev@gmail.com>. Creator: <https://x.com/thebuggeddev>

The stadium 3D implementation in this project was **not built entirely from
scratch**. It adapts code and techniques from the reference project's
`index.html` (a single-file vanilla-JS application using Three.js r128).

## What was adapted from the reference project (modified reference code)

Adapted into TypeScript/React modules, with modifications for modern Three.js
(colour-space API), operations-focused features, and our own stadium layout.
Files containing adapted code carry a header comment marking them as such.

| Subsystem | Reference origin (index.html) | StadiumPulse AI location |
|---|---|---|
| Procedural stadium geometry helpers (`ringStrip`, merged box geometry, canvas textures) | ~lines 1923–2078 | `src/scene/` geometry/texture helpers |
| Elliptical arc-length seat layout (`arcTable`, `thetaAt`) and instanced seat generation | ~lines 3252–3446 | `src/scene/` seating module |
| Custom spherical orbit camera + smoothing, seat POV eye/look math | ~lines 3745–3859 | `src/scene/` camera module |
| Instanced crowd with vertex-shader sway (`onBeforeCompile`) | ~lines 3449–3554 | `src/scene/` crowd module |
| Seeded RNG (`mulberry32`) | ~line 1845 | `src/lib/` |
| FPS-adaptive quality (pixel-ratio adaptation) | ~lines 4716–4740 | `src/scene/` quality module |
| Minimap canvas rendering concept | ~lines 4389–4576 | `src/components/` minimap |

## What was intentionally NOT reused (original reference code left behind)

- Ticket checkout, pricing, favourites/cart and seat-purchase UI
- The support/donation modal and author-personal content
- The hardcoded Argentina-vs-Spain match simulation and match card
- The single-file architecture and CDN script loading

## Newly created StadiumPulse AI code (original work)

- All product experiences: Fan Companion, Accessibility Navigation, Volunteer
  Reporter, Operations Command Center, Scenario Lab
- The deterministic domain engine: stadium movement graph, Dijkstra routing,
  incidents, scenarios, health score, audit log
- The shared Zustand store and all TypeScript domain types
- All Google Gemini integration: serverless API routes, Zod schemas, prompt
  templates, fallbacks, prompt-injection defences
- The StadiumPulse AI design system, UI components and pages
- All tests and documentation

## Third-party libraries

- **Three.js** (npm, MIT License) — © 2010–present three.js authors.
  The reference project used Three.js r128 and GSAP via CDN; StadiumPulse AI
  uses Three.js from npm and does not use GSAP.

## Disclaimer

Independent prototype. Not affiliated with or endorsed by FIFA. All venue,
match and operational data is simulated.
