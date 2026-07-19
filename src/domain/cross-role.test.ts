/**
 * Cross-role workflow integration test — mirrors the judge demo flow.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useStadiumStore } from '../store/stadium-store';
import { buildBaselineSnapshot, applyScenario } from './scenarios';
import { computeHealth } from './health';
import { computeRoute } from './routing';
import { extractIncidentFallback } from './incident-extraction';
import { draftAnnouncementFallback } from './announcements';
import { STADIUM_GRAPH } from '../data/stadium-graph';
import { DEFAULT_PREFERENCES } from '../types/domain';
import { resetIds } from '../lib/ids';

beforeEach(() => {
  resetIds();
  useStadiumStore.setState({ ...buildBaselineSnapshot(), auditLog: [] });
});

describe('cross-role demo flow', () => {
  it('runs volunteer → operator → announcement → fan → recovery', () => {
    const s = () => useStadiumStore.getState();
    const healthBefore = computeHealth(s()).overall;

    // 1. Fan gets a step-free route to Section 315.
    const fanRoute = computeRoute(
      { graph: STADIUM_GRAPH, crowd: s().crowd, facilities: s().facilities },
      {
        fromNodeId: 'gate-a',
        toNodeId: 'section-315',
        mode: 'step_free',
        preferences: DEFAULT_PREFERENCES,
      },
    );
    expect(fanRoute.ok).toBe(true);

    // 2. Volunteer reports the Gate B blockage; extraction is structured.
    const extraction = extractIncidentFallback(
      'A huge queue is forming near Gate B and wheelchair users cannot move through the corridor.',
    );
    const incident = s().reportIncident(extraction, {
      rawReport: 'A huge queue is forming near Gate B…',
      reportedBy: 'volunteer',
      provenance: 'fallback',
    });

    // 3. Crowd overlay changes (scenario layer) and health drops.
    applyScenario(s(), 'gate_b_surge');
    expect(s().crowd['gate-b-concourse']).toBeGreaterThan(0.8);
    expect(computeHealth(s()).overall).toBeLessThan(healthBefore);

    // 4. Operator acknowledges, approves the redirection, drafts announcement.
    s().acknowledgeIncident(incident.id, 'operator');
    s().approveAction(incident.id, 0, 'operator');
    const draft = draftAnnouncementFallback(
      s().incidents.find((i) => i.id === incident.id) ??
        (() => {
          throw new Error('incident lost');
        })(),
    );
    const ann = s().addAnnouncement({
      incidentId: incident.id,
      title: draft.title,
      translations: draft.translations,
      provenance: 'fallback',
    });
    expect(ann.translations).toHaveLength(4);

    // 5. Publish requires approval first; then the fan feed receives it.
    expect(s().publishAnnouncement(ann.id, 'operator')).toBe(false);
    s().approveAnnouncement(ann.id, 'operator');
    expect(s().publishAnnouncement(ann.id, 'operator')).toBe(true);
    expect(
      s().announcements.filter((a) => a.status === 'published'),
    ).toHaveLength(1);

    // 6. Elevator outage forces the accessible route to change.
    const withOutage = {
      graph: STADIUM_GRAPH,
      crowd: s().crowd,
      facilities: {
        ...s().facilities,
        'elevator-north': { nodeId: 'elevator-north', status: 'outage' as const, queueLoad: 0 },
      },
    };
    const rerouted = computeRoute(withOutage, {
      fromNodeId: 'gate-a',
      toNodeId: 'section-315',
      mode: 'step_free',
      preferences: DEFAULT_PREFERENCES,
    });
    expect(rerouted.ok).toBe(true);
    if (rerouted.ok && fanRoute.ok) {
      expect(rerouted.nodeIds).not.toEqual(fanRoute.nodeIds);
      expect(rerouted.nodeIds).toContain('elevator-south');
    }

    // 7. Operator resolves; health recovers after reset.
    expect(s().resolveIncident(incident.id, 'operator')).toBe(true);
    useStadiumStore.getState().restoreBaseline(buildBaselineSnapshot());
    expect(computeHealth(useStadiumStore.getState()).overall).toBe(healthBefore);

    // 8. Audit trail preserved the full sequence.
    const actions = useStadiumStore.getState().auditLog.map((e) => e.action);
    for (const expected of [
      'incident_reported',
      'scenario_activated',
      'incident_acknowledged',
      'incident_action_approved',
      'announcement_generated',
      'announcement_approved',
      'announcement_published',
      'incident_resolved',
      'scenario_reset',
    ]) {
      expect(actions).toContain(expected);
    }
  });
});
