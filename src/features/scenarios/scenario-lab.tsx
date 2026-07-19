/**
 * StadiumPulse AI — Scenario Lab.
 * Original StadiumPulse AI code.
 */

import { useStadiumStore } from '../../store/stadium-store';
import { buildScenario, applyScenario, resetScenario, SCENARIO_IDS } from '../../domain/scenarios';
import { computeHealth } from '../../domain/health';

export function ScenarioLab() {
  const store = useStadiumStore();
  const active = store.simulation.activeScenario;
  const health = computeHealth(store);

  return (
    <>
      <section className="sp-card" aria-labelledby="scen-heading">
        <h2 id="scen-heading">Scenario Lab</h2>
        <p className="sp-muted">
          Activate an operational scenario. Every scenario updates shared state:
          the 3D twin, crowd overlays, incident queue, routes, dashboards and
          the health score all react.
        </p>
        <p aria-live="polite">
          Stadium health:{' '}
          <span
            className={`sp-badge ${
              health.overall > 75
                ? 'sp-badge-healthy'
                : health.overall > 50
                  ? 'sp-badge-caution'
                  : 'sp-badge-urgent'
            }`}
          >
            {health.overall}/100
          </span>
        </p>
        <ul className="sp-list">
          {SCENARIO_IDS.map((id) => {
            const def = buildScenario(id);
            const isActive = active === id;
            return (
              <li key={id} className="sp-card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span>
                    <strong>{def.title}</strong>
                    <span className="sp-muted" style={{ display: 'block' }}>
                      {def.description}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={`sp-btn${isActive ? ' sp-btn-primary' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => applyScenario(useStadiumStore.getState(), id)}
                  >
                    {isActive ? 'Active' : 'Activate'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="sp-btn"
          style={{ marginTop: 10, width: '100%' }}
          onClick={() => resetScenario(useStadiumStore.getState())}
        >
          Reset to normal match day
        </button>
      </section>
    </>
  );
}
