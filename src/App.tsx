import { useStadiumStore } from './store/stadium-store';

export function App() {
  const prefs = useStadiumStore((s) => s.userPreferences);

  return (
    <div
      data-high-contrast={prefs.highContrast}
      data-reduced-motion={prefs.reducedMotion}
      style={{ minHeight: '100%' }}
    >
      <main style={{ padding: 24 }}>
        <h1 style={{ color: 'var(--sp-cyan)' }}>StadiumPulse AI</h1>
        <p style={{ color: 'var(--sp-text-muted)' }}>
          One operational event, the right guidance for everyone.
        </p>
        <p>Foundation milestone — experiences arrive in later milestones.</p>
      </main>
      <footer className="sp-disclaimer">
        Independent prototype. Not affiliated with or endorsed by FIFA. All
        venue, match and operational data is simulated.
      </footer>
    </div>
  );
}
