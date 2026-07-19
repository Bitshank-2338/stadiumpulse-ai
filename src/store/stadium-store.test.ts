import { beforeEach, describe, expect, it } from 'vitest';
import { useStadiumStore } from './stadium-store';
import type { IncidentExtraction } from '../types/domain';
import { resetIds } from '../lib/ids';

const baseExtraction: IncidentExtraction = {
  category: 'crowd_congestion',
  severity: 'high',
  summary: 'Dense queue blocking movement near Gate B',
  locationId: 'gate-b-concourse',
  peopleAffectedEstimate: 140,
  accessibilityImpact: 'high',
  operationalImpact: 'high',
  recommendedTeam: 'crowd-operations',
  recommendedActions: ['Redirect general entry toward Gate D'],
  requiresHumanApproval: true,
  missingInformation: [],
  confidence: 0.9,
};

function resetStore() {
  useStadiumStore.setState({
    incidents: [],
    announcements: [],
    auditLog: [],
    routes: [],
  });
  resetIds();
}

describe('stadium store — incidents', () => {
  beforeEach(resetStore);

  it('reports an incident and appends an audit entry', () => {
    const inc = useStadiumStore.getState().reportIncident(baseExtraction, {
      rawReport: 'huge queue at gate B',
      reportedBy: 'volunteer',
      provenance: 'fallback',
    });
    const s = useStadiumStore.getState();
    expect(s.incidents).toHaveLength(1);
    expect(inc.status).toBe('reported');
    expect(s.auditLog.some((e) => e.action === 'incident_reported')).toBe(true);
  });

  it('forces human approval for high-risk categories even if AI says otherwise', () => {
    const inc = useStadiumStore.getState().reportIncident(
      { ...baseExtraction, category: 'medical', requiresHumanApproval: false },
      { rawReport: 'medical issue', reportedBy: 'volunteer', provenance: 'fallback' },
    );
    expect(inc.requiresHumanApproval).toBe(true);
  });

  it('cannot resolve an incident straight from reported status', () => {
    const inc = useStadiumStore.getState().reportIncident(baseExtraction, {
      rawReport: 'x',
      reportedBy: 'volunteer',
      provenance: 'fallback',
    });
    expect(useStadiumStore.getState().resolveIncident(inc.id, 'operator')).toBe(false);
  });

  it('resolves after acknowledgement, and blocks high-risk without an operator decision', () => {
    const store = useStadiumStore.getState();
    const normal = store.reportIncident(baseExtraction, {
      rawReport: 'x',
      reportedBy: 'volunteer',
      provenance: 'fallback',
    });
    const medical = store.reportIncident(
      { ...baseExtraction, category: 'medical' },
      { rawReport: 'y', reportedBy: 'volunteer', provenance: 'fallback' },
    );
    store.acknowledgeIncident(normal.id, 'operator');
    store.acknowledgeIncident(medical.id, 'operator');

    expect(useStadiumStore.getState().resolveIncident(normal.id, 'operator')).toBe(true);
    // High-risk with no approved action & no note → blocked.
    expect(useStadiumStore.getState().resolveIncident(medical.id, 'operator')).toBe(false);
    // After an explicit operator decision it resolves.
    useStadiumStore.getState().approveAction(medical.id, 0, 'operator');
    expect(useStadiumStore.getState().resolveIncident(medical.id, 'operator')).toBe(true);
  });

  it('reopens only resolved incidents', () => {
    const store = useStadiumStore.getState();
    const inc = store.reportIncident(baseExtraction, {
      rawReport: 'x',
      reportedBy: 'volunteer',
      provenance: 'fallback',
    });
    expect(store.reopenIncident(inc.id, 'operator')).toBe(false);
    store.acknowledgeIncident(inc.id, 'operator');
    store.resolveIncident(inc.id, 'operator');
    expect(useStadiumStore.getState().reopenIncident(inc.id, 'operator')).toBe(true);
  });
});

describe('stadium store — announcements', () => {
  beforeEach(resetStore);

  it('only publishes approved announcements', () => {
    const a = useStadiumStore.getState().addAnnouncement({
      title: 'Gate D redirection',
      translations: [{ language: 'en', text: 'Please use Gate D.' }],
      provenance: 'fallback',
    });
    expect(useStadiumStore.getState().publishAnnouncement(a.id, 'operator')).toBe(false);
    useStadiumStore.getState().approveAnnouncement(a.id, 'operator');
    expect(useStadiumStore.getState().publishAnnouncement(a.id, 'operator')).toBe(true);
    const published = useStadiumStore.getState().announcements.find((x) => x.id === a.id);
    expect(published?.status).toBe('published');
    expect(published?.publishedAt).toBeTypeOf('number');
  });
});

describe('stadium store — preferences', () => {
  beforeEach(resetStore);

  it('merges accessibility preference patches', () => {
    useStadiumStore.getState().setPreferences({ stepFree: true, highContrast: true });
    const p = useStadiumStore.getState().userPreferences;
    expect(p.stepFree).toBe(true);
    expect(p.highContrast).toBe(true);
    expect(p.wheelchair).toBe(false);
  });
});
