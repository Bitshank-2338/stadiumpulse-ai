import { lazy, Suspense } from 'react';
import { useStadiumStore } from './store/stadium-store';

const StadiumCanvas = lazy(() =>
  import('./components/stadium-canvas').then((m) => ({ default: m.StadiumCanvas })),
);

export function App() {
  const prefs = useStadiumStore((s) => s.userPreferences);

  return (
    <div
      data-high-contrast={prefs.highContrast}
      data-reduced-motion={prefs.reducedMotion}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <header
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--sp-border)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, color: 'var(--sp-cyan)' }}>
          StadiumPulse AI
        </h1>
        <span style={{ fontSize: 12, color: 'var(--sp-text-muted)' }}>
          North America Tournament 2026 Simulation
        </span>
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>
        <Suspense
          fallback={
            <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
              Loading…
            </div>
          }
        >
          <StadiumCanvas reducedMotion={prefs.reducedMotion} />
        </Suspense>
      </main>
      <footer className="sp-disclaimer">
        Independent prototype. Not affiliated with or endorsed by FIFA. All
        venue, match and operational data is simulated.
      </footer>
    </div>
  );
}
