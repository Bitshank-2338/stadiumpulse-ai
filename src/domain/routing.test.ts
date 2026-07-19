import { describe, expect, it } from 'vitest';
import { computeRoute, rankFacilities } from './routing';
import type { RoutingContext } from './routing';
import { STADIUM_GRAPH } from '../data/stadium-graph';
import { DEFAULT_PREFERENCES } from '../types/domain';
import type { FacilityState } from '../types/domain';

function ctx(overrides: Partial<RoutingContext> = {}): RoutingContext {
  return {
    graph: STADIUM_GRAPH,
    crowd: {},
    facilities: {},
    ...overrides,
  };
}

const prefs = DEFAULT_PREFERENCES;

describe('routing — standard', () => {
  it('finds a route from Gate A to Section 114', () => {
    const out = computeRoute(ctx(), {
      fromNodeId: 'gate-a',
      toNodeId: 'section-114',
      mode: 'shortest',
      preferences: prefs,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nodeIds[0]).toBe('gate-a');
      expect(out.nodeIds[out.nodeIds.length - 1]).toBe('section-114');
      expect(out.distanceMeters).toBeGreaterThan(0);
      expect(out.etaSeconds).toBeGreaterThan(0);
      expect(out.path.length).toBe(out.nodeIds.length);
    }
  });

  it('reaches the upper tier (Section 315) from Gate A', () => {
    const out = computeRoute(ctx(), {
      fromNodeId: 'gate-a',
      toNodeId: 'section-315',
      mode: 'shortest',
      preferences: prefs,
    });
    expect(out.ok).toBe(true);
  });
});

describe('routing — congestion aware', () => {
  it('avoids a congested zone in least_crowded mode', () => {
    const congested = ctx({
      crowd: { 'gate-b-concourse': 0.95 },
    });
    const short = computeRoute(congested, {
      fromNodeId: 'gate-a',
      toNodeId: 'shuttle-point',
      mode: 'shortest',
      preferences: prefs,
    });
    const least = computeRoute(congested, {
      fromNodeId: 'gate-a',
      toNodeId: 'shuttle-point',
      mode: 'least_crowded',
      preferences: prefs,
    });
    expect(short.ok && least.ok).toBe(true);
    if (short.ok && least.ok) {
      // Least-crowded path should differ or match with equal/greater distance.
      expect(least.maxCongestion).toBeLessThanOrEqual(short.maxCongestion);
    }
  });
});

describe('routing — step-free', () => {
  it('step-free route to upper tier uses an elevator, never stairs/escalators', () => {
    const out = computeRoute(ctx(), {
      fromNodeId: 'gate-a',
      toNodeId: 'section-315',
      mode: 'step_free',
      preferences: prefs,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.stepFree).toBe(true);
      expect(out.usesElevator).toBe(true);
      expect(out.nodeIds).not.toContain('stairs-east');
      expect(out.nodeIds).not.toContain('escalator-north');
    }
  });

  it('reroutes via south elevator when north elevator is out', () => {
    const facilities: Record<string, FacilityState> = {
      'elevator-north': { nodeId: 'elevator-north', status: 'outage', queueLoad: 0 },
    };
    const out = computeRoute(ctx({ facilities }), {
      fromNodeId: 'gate-a',
      toNodeId: 'section-315',
      mode: 'step_free',
      preferences: prefs,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nodeIds).toContain('elevator-south');
      expect(out.nodeIds).not.toContain('elevator-north');
    }
  });

  it('explains no accessible route when all elevators are out', () => {
    const facilities: Record<string, FacilityState> = {
      'elevator-north': { nodeId: 'elevator-north', status: 'outage', queueLoad: 0 },
      'elevator-south': { nodeId: 'elevator-south', status: 'outage', queueLoad: 0 },
    };
    const out = computeRoute(ctx({ facilities }), {
      fromNodeId: 'gate-a',
      toNodeId: 'section-315',
      mode: 'step_free',
      preferences: prefs,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe('no_accessible_route');
      expect(out.explanation.length).toBeGreaterThan(20);
      expect(out.fallbackNodeId).toBeDefined();
    }
  });
});

describe('routing — edge cases', () => {
  it('origin equals destination', () => {
    const out = computeRoute(ctx(), {
      fromNodeId: 'gate-a',
      toNodeId: 'gate-a',
      mode: 'shortest',
      preferences: prefs,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('same_origin_destination');
  });

  it('unknown node yields a helpful explanation', () => {
    const out = computeRoute(ctx(), {
      fromNodeId: 'gate-z',
      toNodeId: 'section-114',
      mode: 'shortest',
      preferences: prefs,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('unknown_node');
  });

  it('closed destination points to an assistance desk', () => {
    const facilities: Record<string, FacilityState> = {
      'quiet-room': { nodeId: 'quiet-room', status: 'closed', queueLoad: 0 },
    };
    const out = computeRoute(ctx({ facilities }), {
      fromNodeId: 'gate-a',
      toNodeId: 'quiet-room',
      mode: 'shortest',
      preferences: prefs,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe('destination_closed');
      expect(out.fallbackNodeId).toContain('assistance-desk');
    }
  });
});

describe('routing — accessibility preference effects', () => {
  it('wheelchair preference forces step-free even in shortest mode', () => {
    const out = computeRoute(ctx(), {
      fromNodeId: 'gate-a',
      toNodeId: 'section-315',
      mode: 'shortest',
      preferences: { ...prefs, wheelchair: true },
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.stepFree).toBe(true);
  });

  it('extra walking time inflates the ETA', () => {
    const normal = computeRoute(ctx(), {
      fromNodeId: 'gate-a',
      toNodeId: 'section-114',
      mode: 'shortest',
      preferences: prefs,
    });
    const extra = computeRoute(ctx(), {
      fromNodeId: 'gate-a',
      toNodeId: 'section-114',
      mode: 'shortest',
      preferences: { ...prefs, extraWalkingTime: true },
    });
    expect(normal.ok && extra.ok).toBe(true);
    if (normal.ok && extra.ok) {
      expect(extra.etaSeconds).toBeGreaterThan(normal.etaSeconds);
    }
  });
});

describe('facility ranking', () => {
  it('ranks restrooms by travel time and prioritizes accessible ones when asked', () => {
    const ranked = rankFacilities(
      ctx(),
      'gate-a',
      ['accessible_restroom'],
      'step_free',
      { ...prefs, accessibleRestroomPriority: true },
    );
    expect(ranked.length).toBeGreaterThan(0);
    const first = ranked[0];
    expect(first?.outcome.ok).toBe(true);
    expect(first?.nodeId).toBe('accessible-restroom-a'); // nearest to gate A
  });
});
