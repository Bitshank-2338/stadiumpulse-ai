import { lazy, Suspense, useMemo, useState } from 'react';
import { useStadiumStore } from './store/stadium-store';
import { crowdHeat, facilityMarkers, incidentMarkers, outageMarkers } from './store/selectors';
import { FanCompanion } from './features/fan/fan-companion';
import { AccessibilityPanel } from './features/access/accessibility-panel';
import { ScenarioLab } from './features/scenarios/scenario-lab';
import { VolunteerReporter } from './features/volunteer/volunteer-reporter';
import { CommandCenter } from './features/ops/command-center';
import './styles/ui.css';

const StadiumCanvas = lazy(() =>
  import('./components/stadium-canvas').then((m) => ({ default: m.StadiumCanvas })),
);

type View = 'twin' | 'fan' | 'access' | 'volunteer' | 'ops' | 'scenarios';

const VIEWS: { id: View; label: string }[] = [
  { id: 'twin', label: 'Digital Twin' },
  { id: 'fan', label: 'Fan Companion' },
  { id: 'access', label: 'Accessibility' },
  { id: 'volunteer', label: 'Volunteer' },
  { id: 'ops', label: 'Operations' },
  { id: 'scenarios', label: 'Scenario Lab' },
];

interface LayerState {
  crowd: boolean;
  incidents: boolean;
  facilities: boolean;
  route: boolean;
  outages: boolean;
}

export function App() {
  const prefs = useStadiumStore((s) => s.userPreferences);
  const incidents = useStadiumStore((s) => s.incidents);
  const facilities = useStadiumStore((s) => s.facilities);
  const crowd = useStadiumStore((s) => s.crowd);
  const routes = useStadiumStore((s) => s.routes);

  const aiStatus = useStadiumStore((s) => s.aiStatus);
  const [view, setView] = useState<View>('fan');
  const [layers, setLayers] = useState<LayerState>({
    crowd: true,
    incidents: true,
    facilities: false,
    route: true,
    outages: true,
  });

  const markers = useMemo(() => {
    const out = [];
    if (layers.incidents) out.push(...incidentMarkers(incidents));
    if (layers.outages) out.push(...outageMarkers(facilities));
    if (layers.facilities) out.push(...facilityMarkers());
    return out;
  }, [layers.incidents, layers.outages, layers.facilities, incidents, facilities]);

  const heat = useMemo(
    () => (layers.crowd ? crowdHeat(crowd) : []),
    [layers.crowd, crowd],
  );

  const fanRoute = routes.find((r) => r.id === 'fan-route');
  const routePath =
    layers.route && fanRoute?.outcome.ok ? fanRoute.outcome.path : null;
  const routeColor =
    fanRoute?.ownerRole === 'accessibility' ? 0xc4b5fd : 0x22d3ee;

  const toggleLayer = (k: keyof LayerState): void =>
    setLayers((l) => ({ ...l, [k]: !l[k] }));

  return (
    <div
      data-high-contrast={prefs.highContrast}
      data-reduced-motion={prefs.reducedMotion}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <header
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--sp-border)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 17, color: 'var(--sp-cyan)' }}>StadiumPulse AI</h1>
        <span style={{ fontSize: 12, color: 'var(--sp-text-muted)' }}>
          North America Tournament 2026 Simulation
        </span>
        <span
          className={`sp-badge ${aiStatus.lastProvenance === 'gemini' ? 'sp-badge-cyan' : 'sp-badge-muted'}`}
          style={{ marginLeft: 'auto', fontSize: 11 }}
          title={aiStatus.lastError ?? undefined}
        >
          AI:{' '}
          {aiStatus.lastProvenance === null
            ? 'idle'
            : aiStatus.lastProvenance === 'gemini'
              ? `Gemini ${aiStatus.lastLatencyMs ?? '–'}ms`
              : 'deterministic fallback'}
        </span>
      </header>

      <nav className="sp-nav" aria-label="Product areas">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-current={view === v.id ? 'page' : undefined}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <div className="sp-layout" style={{ flex: 1, paddingBottom: 22 }}>
        <div className="sp-scene-wrap">
          <Suspense
            fallback={
              <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                Loading 3D…
              </div>
            }
          >
            <StadiumCanvas
              reducedMotion={prefs.reducedMotion}
              markers={markers}
              routePath={routePath ?? null}
              routeColor={routeColor}
              zoneHeat={heat}
            />
          </Suspense>
          <div
            role="group"
            aria-label="Map layers"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
            }}
          >
            {(
              [
                ['crowd', 'Crowd'],
                ['incidents', 'Incidents'],
                ['route', 'Route'],
                ['facilities', 'Facilities'],
                ['outages', 'Outages'],
              ] as [keyof LayerState, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className="sp-btn"
                style={{ minHeight: 34, padding: '4px 10px', fontSize: 12 }}
                aria-pressed={layers[k]}
                onClick={() => toggleLayer(k)}
              >
                {label} {layers[k] ? '●' : '○'}
              </button>
            ))}
          </div>
        </div>

        <aside className="sp-panel" aria-label="Controls">
          {view === 'twin' && (
            <section className="sp-card">
              <h2>Live digital twin</h2>
              <p className="sp-muted">
                Drag to rotate · scroll to zoom · arrow keys to orbit. Toggle
                map layers in the top-left corner. Activate scenarios in the
                Scenario Lab to see the twin react.
              </p>
              <p className="sp-muted">
                Active incidents: {incidents.filter((i) => i.status !== 'resolved' && i.status !== 'rejected').length}
              </p>
            </section>
          )}
          {view === 'fan' && <FanCompanion />}
          {view === 'access' && (
            <>
              <AccessibilityPanel />
              <FanCompanion />
            </>
          )}
          {view === 'volunteer' && <VolunteerReporter />}
          {view === 'ops' && <CommandCenter />}
          {view === 'scenarios' && <ScenarioLab />}
        </aside>
      </div>

      <footer className="sp-disclaimer">
        Independent prototype. Not affiliated with or endorsed by FIFA. All
        venue, match and operational data is simulated.
      </footer>
    </div>
  );
}
