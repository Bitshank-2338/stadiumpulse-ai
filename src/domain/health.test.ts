import { describe, expect, it } from 'vitest';
import { computeHealth } from './health';
import { buildBaselineSnapshot } from './scenarios';
import type {
  CrowdMap,
  FacilityState,
  Incident,
  IncidentSeverity,
  SustainabilityState,
  TransportState,
} from '../types/domain';

// Fixtures follow the same pattern as scenarios.test.ts / stadium-store.test.ts:
// build a full baseline snapshot from the real scenario engine, then clone and
// mutate individual slices per test so every fixture reflects real graph shapes.
function baseline() {
  const snap = buildBaselineSnapshot();
  return {
    crowd: snap.crowd,
    incidents: snap.incidents,
    facilities: snap.facilities,
    transport: snap.transport,
    sustainability: snap.sustainability,
  };
}

let incidentSeq = 0;
function makeIncident(overrides: Partial<Incident> & { severity: IncidentSeverity }): Incident {
  incidentSeq += 1;
  return {
    id: `incident-${incidentSeq}`,
    status: 'reported',
    reportedBy: 'scenario',
    rawReport: 'test incident',
    createdAt: 0,
    updatedAt: 0,
    notes: [],
    provenance: 'fixture',
    approvedActions: [],
    rejectedActions: [],
    category: 'other',
    summary: 'test',
    locationId: 'gate-a',
    peopleAffectedEstimate: 1,
    accessibilityImpact: 'none',
    operationalImpact: 'low',
    recommendedTeam: 'guest-services',
    recommendedActions: [],
    requiresHumanApproval: false,
    missingInformation: [],
    confidence: 1,
    ...overrides,
  };
}

function uniformCrowd(level: number, zoneIds: string[]): CrowdMap {
  const crowd: CrowdMap = {};
  for (const z of zoneIds) crowd[z] = level;
  return crowd;
}

describe('computeHealth — baseline', () => {
  it('gives a high overall score and every component at or above expected baseline floors', () => {
    const h = computeHealth(baseline());
    expect(h.overall).toBeGreaterThanOrEqual(90);
    expect(h.crowd).toBeGreaterThanOrEqual(75);
    expect(h.incidents).toBe(100);
    expect(h.accessibility).toBe(100);
    expect(h.transport).toBeGreaterThanOrEqual(90);
    expect(h.sustainability).toBe(100);
  });

  it('matches a hand-computed value for the exact baseline fixture', () => {
    // baseline crowd is uniform 0.3 for every zone:
    //   crowd = 100 - 0.3*60 - max(0, 0.3-0.7)*100 = 100 - 18 - 0 = 82
    // no incidents -> incidents = 100
    // no outages/closed facilities -> accessibility = 100
    // metroStatus 'normal' (base 95), load max 0.35 (<0.75, no penalty) -> transport = 95
    // wasteFill max 0.4 (<0.7, no penalty), no alerts -> sustainability = 100
    // overall = 82*0.28 + 100*0.30 + 100*0.16 + 95*0.14 + 100*0.12 = 94.26 -> round = 94
    const h = computeHealth(baseline());
    expect(h.crowd).toBe(82);
    expect(h.incidents).toBe(100);
    expect(h.accessibility).toBe(100);
    expect(h.transport).toBe(95);
    expect(h.sustainability).toBe(100);
    expect(h.overall).toBe(94);
  });
});

describe('computeHealth — crowd component', () => {
  it('raises the crowd score as average occupancy drops', () => {
    const base = baseline();
    const zoneIds = Object.keys(base.crowd);
    const lowCrowd = computeHealth({ ...base, crowd: uniformCrowd(0.05, zoneIds) });
    const highCrowd = computeHealth({ ...base, crowd: uniformCrowd(0.6, zoneIds) });
    expect(lowCrowd.crowd).toBeGreaterThan(highCrowd.crowd);
  });

  it('applies an extra penalty once any single zone exceeds 0.7 occupancy, beyond the average effect', () => {
    const base = baseline();
    const zoneIds = Object.keys(base.crowd);
    const evenCrowd: CrowdMap = uniformCrowd(0.5, zoneIds);
    const spikedCrowd: CrowdMap = { ...evenCrowd };
    const [firstZone] = zoneIds;
    if (firstZone) spikedCrowd[firstZone] = 0.95; // pushes max well past the 0.7 threshold
    const even = computeHealth({ ...base, crowd: evenCrowd });
    const spiked = computeHealth({ ...base, crowd: spikedCrowd });
    expect(spiked.crowd).toBeLessThan(even.crowd);
  });
});

describe('computeHealth — incidents component', () => {
  it('lowers the incidents score for each unresolved incident', () => {
    const base = baseline();
    const clean = computeHealth(base);
    const withIncident = computeHealth({
      ...base,
      incidents: [makeIncident({ severity: 'medium' })],
    });
    expect(withIncident.incidents).toBeLessThan(clean.incidents);
  });

  it('weighs critical incidents more heavily than low-severity ones', () => {
    const base = baseline();
    const critical = computeHealth({
      ...base,
      incidents: [makeIncident({ severity: 'critical' })],
    });
    const low = computeHealth({
      ...base,
      incidents: [makeIncident({ severity: 'low' })],
    });
    expect(critical.incidents).toBeLessThan(low.incidents);
  });

  it('ignores resolved and rejected incidents', () => {
    const base = baseline();
    const withClosedOnly = computeHealth({
      ...base,
      incidents: [
        makeIncident({ severity: 'critical', status: 'resolved' }),
        makeIncident({ severity: 'critical', status: 'rejected' }),
      ],
    });
    expect(withClosedOnly.incidents).toBe(100);
  });
});

describe('computeHealth — accessibility component', () => {
  it('lowers accessibility when a facility is in outage', () => {
    const base = baseline();
    const clean = computeHealth(base);
    const facilityId = Object.keys(base.facilities)[0];
    if (!facilityId) throw new Error('baseline fixture has no facilities to test with');
    const withOutage: Record<string, FacilityState> = {
      ...base.facilities,
      [facilityId]: { ...base.facilities[facilityId], status: 'outage' } as FacilityState,
    };
    const outage = computeHealth({ ...base, facilities: withOutage });
    expect(outage.accessibility).toBeLessThan(clean.accessibility);
  });

  it('penalizes outage more heavily than closed', () => {
    const base = baseline();
    const facilityId = Object.keys(base.facilities)[0];
    if (!facilityId) throw new Error('baseline fixture has no facilities to test with');
    const outageFacilities: Record<string, FacilityState> = {
      ...base.facilities,
      [facilityId]: { ...base.facilities[facilityId], status: 'outage' } as FacilityState,
    };
    const closedFacilities: Record<string, FacilityState> = {
      ...base.facilities,
      [facilityId]: { ...base.facilities[facilityId], status: 'closed' } as FacilityState,
    };
    const outage = computeHealth({ ...base, facilities: outageFacilities });
    const closed = computeHealth({ ...base, facilities: closedFacilities });
    expect(outage.accessibility).toBeLessThan(closed.accessibility);
  });
});

describe('computeHealth — transport component', () => {
  it('maps metro status to transport score in the order suspended < overloaded < delayed < normal', () => {
    const base = baseline();
    const withStatus = (metroStatus: TransportState['metroStatus']) =>
      computeHealth({
        ...base,
        transport: { ...base.transport, metroStatus, load: { 'metro-point': 0.2 } },
      }).transport;

    const suspended = withStatus('suspended');
    const overloaded = withStatus('overloaded');
    const delayed = withStatus('delayed');
    const normal = withStatus('normal');

    expect(suspended).toBe(30);
    expect(overloaded).toBe(55);
    expect(delayed).toBe(75);
    expect(normal).toBe(95);
    expect(suspended).toBeLessThan(overloaded);
    expect(overloaded).toBeLessThan(delayed);
    expect(delayed).toBeLessThan(normal);
  });

  it('applies an extra penalty once transport load exceeds 0.75, on top of the status base', () => {
    const base = baseline();
    const lowLoad = computeHealth({
      ...base,
      transport: { ...base.transport, metroStatus: 'normal', load: { 'metro-point': 0.5 } },
    }).transport;
    const highLoad = computeHealth({
      ...base,
      transport: { ...base.transport, metroStatus: 'normal', load: { 'metro-point': 0.99 } },
    }).transport;
    expect(highLoad).toBeLessThan(lowLoad);
  });
});

describe('computeHealth — sustainability component', () => {
  it('lowers sustainability once waste fill exceeds 0.7', () => {
    const base = baseline();
    const lowFill = computeHealth({
      ...base,
      sustainability: { ...base.sustainability, wasteFill: { 'food-court-1': 0.4 } },
    }).sustainability;
    const highFill = computeHealth({
      ...base,
      sustainability: { ...base.sustainability, wasteFill: { 'food-court-1': 0.95 } },
    }).sustainability;
    expect(highFill).toBeLessThan(lowFill);
  });

  it('lowers sustainability as sustainability alerts accumulate', () => {
    const base = baseline();
    const noAlerts = computeHealth({
      ...base,
      sustainability: { ...base.sustainability, alerts: [] },
    }).sustainability;
    const manyAlerts = computeHealth({
      ...base,
      sustainability: { ...base.sustainability, alerts: ['a', 'b', 'c', 'd'] },
    }).sustainability;
    expect(manyAlerts).toBeLessThan(noAlerts);
  });
});

describe('computeHealth — clamping to 0..100', () => {
  it('never pushes any component or the overall score below 0 under extreme adverse inputs', () => {
    const zoneIds = Object.keys(baseline().crowd);
    const extremeIncidents: Incident[] = Array.from({ length: 20 }, () =>
      makeIncident({ severity: 'critical' }),
    );
    const facilities: Record<string, FacilityState> = {};
    for (const [id, f] of Object.entries(baseline().facilities)) {
      facilities[id] = { ...f, status: 'outage' };
    }
    const sustainability: SustainabilityState = {
      wasteFill: { a: 5, b: 3 },
      energyUseKwh: 0,
      waterUseLiters: 0,
      alerts: Array.from({ length: 50 }, (_, i) => `alert-${i}`),
    };
    const transport: TransportState = {
      load: { 'metro-point': 5, 'shuttle-point': 5 },
      metroStatus: 'suspended',
      shuttleStatus: 'normal',
      advisories: [],
    };
    const h = computeHealth({
      crowd: uniformCrowd(5, zoneIds),
      incidents: extremeIncidents,
      facilities,
      transport,
      sustainability,
    });
    expect(h.overall).toBeGreaterThanOrEqual(0);
    expect(h.crowd).toBeGreaterThanOrEqual(0);
    expect(h.incidents).toBeGreaterThanOrEqual(0);
    expect(h.accessibility).toBeGreaterThanOrEqual(0);
    expect(h.transport).toBeGreaterThanOrEqual(0);
    expect(h.sustainability).toBeGreaterThanOrEqual(0);
  });

  it('never pushes any component or the overall score above 100 under the best plausible inputs', () => {
    const base = baseline();
    const zoneIds = Object.keys(base.crowd);
    const h = computeHealth({
      crowd: uniformCrowd(0, zoneIds),
      incidents: [],
      facilities: base.facilities,
      transport: { load: {}, metroStatus: 'normal', shuttleStatus: 'normal', advisories: [] },
      sustainability: { wasteFill: {}, energyUseKwh: 0, waterUseLiters: 0, alerts: [] },
    });
    expect(h.overall).toBeLessThanOrEqual(100);
    expect(h.crowd).toBeLessThanOrEqual(100);
    expect(h.incidents).toBeLessThanOrEqual(100);
    expect(h.accessibility).toBeLessThanOrEqual(100);
    expect(h.transport).toBeLessThanOrEqual(100);
    expect(h.sustainability).toBeLessThanOrEqual(100);
  });
});

describe('computeHealth — overall monotonicity', () => {
  it('produces a strictly lower overall score as conditions get strictly worse', () => {
    const base = baseline();
    const zoneIds = Object.keys(base.crowd);
    const good = computeHealth(base);
    const bad = computeHealth({
      crowd: uniformCrowd(0.9, zoneIds),
      incidents: [makeIncident({ severity: 'critical' }), makeIncident({ severity: 'high' })],
      facilities: Object.fromEntries(
        Object.entries(base.facilities).map(([id, f]) => [id, { ...f, status: 'outage' as const }]),
      ),
      transport: { ...base.transport, metroStatus: 'suspended', load: { 'metro-point': 0.99 } },
      sustainability: { ...base.sustainability, wasteFill: { 'food-court-1': 0.99 }, alerts: ['x', 'y'] },
    });
    expect(bad.overall).toBeLessThan(good.overall);
  });
});
