import { beforeEach, describe, expect, it } from 'vitest';
import { applyScenario, buildBaselineSnapshot, buildScenario, resetScenario, SCENARIO_IDS } from './scenarios';
import { computeHealth } from './health';
import { useStadiumStore } from '../store/stadium-store';
import { resetIds } from '../lib/ids';

beforeEach(() => {
  resetIds();
  useStadiumStore.getState().restoreBaseline(buildBaselineSnapshot());
  useStadiumStore.setState({ auditLog: [] });
});

describe('scenario definitions', () => {
  it('every scenario builds without error and has a title', () => {
    for (const id of SCENARIO_IDS) {
      const def = buildScenario(id);
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.crowd).toBeTypeOf('object');
    }
  });

  it('seeded incident locations exist in the stadium graph', async () => {
    const { STADIUM_GRAPH } = await import('../data/stadium-graph');
    for (const id of SCENARIO_IDS) {
      for (const seed of buildScenario(id).seededIncidents) {
        expect(
          STADIUM_GRAPH.nodes[seed.extraction.locationId],
          `${id}: ${seed.extraction.locationId}`,
        ).toBeDefined();
      }
    }
  });
});

describe('scenario activation', () => {
  it('gate B surge raises crowd, seeds an incident, and lowers health', () => {
    const store = useStadiumStore.getState();
    const before = computeHealth(useStadiumStore.getState());
    applyScenario(store, 'gate_b_surge');
    const s = useStadiumStore.getState();
    expect(s.simulation.activeScenario).toBe('gate_b_surge');
    expect(s.crowd['gate-b-concourse']).toBeGreaterThan(0.8);
    expect(s.incidents.length).toBe(1);
    expect(s.incidents[0]?.provenance).toBe('fixture');
    const after = computeHealth(s);
    expect(after.overall).toBeLessThan(before.overall);
    expect(s.auditLog.some((e) => e.action === 'scenario_activated')).toBe(true);
  });

  it('elevator outage marks the facility as outage', () => {
    applyScenario(useStadiumStore.getState(), 'elevator_outage');
    const s = useStadiumStore.getState();
    expect(s.facilities['elevator-north']?.status).toBe('outage');
  });

  it('metro overload changes transport state and health transport score', () => {
    applyScenario(useStadiumStore.getState(), 'metro_overload');
    const s = useStadiumStore.getState();
    expect(s.transport.metroStatus).toBe('overloaded');
    const h = computeHealth(s);
    expect(h.transport).toBeLessThan(70);
  });
});

describe('scenario reset', () => {
  it('reset restores a consistent baseline', () => {
    const store = useStadiumStore.getState();
    applyScenario(store, 'metro_overload');
    resetScenario(useStadiumStore.getState());
    const s = useStadiumStore.getState();
    expect(s.simulation.activeScenario).toBe('normal_match_day');
    expect(s.incidents).toHaveLength(0);
    expect(s.transport.metroStatus).toBe('normal');
    expect(s.crowd['gate-b-concourse']).toBeLessThan(0.5);
    expect(s.auditLog.some((e) => e.action === 'scenario_reset')).toBe(true);
  });
});

describe('health score', () => {
  it('baseline health is high', () => {
    const h = computeHealth(useStadiumStore.getState());
    expect(h.overall).toBeGreaterThan(80);
  });

  it('critical incidents weigh more than low ones', () => {
    const store = useStadiumStore.getState();
    applyScenario(store, 'missing_child'); // critical
    const critical = computeHealth(useStadiumStore.getState());
    resetScenario(useStadiumStore.getState());
    applyScenario(useStadiumStore.getState(), 'multilingual_spike'); // low
    const low = computeHealth(useStadiumStore.getState());
    expect(critical.incidents).toBeLessThan(low.incidents);
  });
});
