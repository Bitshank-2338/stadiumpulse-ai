import { describe, expect, it } from 'vitest';
import {
  extractIncidentFallback,
  isDuplicateIncident,
} from './incident-extraction';
import { draftAnnouncementFallback } from './announcements';
import { HIGH_RISK_CATEGORIES } from '../types/domain';
import type { Incident } from '../types/domain';

describe('incident extraction fallback', () => {
  it('extracts the Gate B crowd blockage example correctly', () => {
    const out = extractIncidentFallback(
      'A huge queue is forming near Gate B and wheelchair users cannot move through the corridor.',
    );
    expect(out.category).toBe('crowd_congestion');
    expect(out.locationId).toBe('gate-b');
    expect(out.accessibilityImpact).toBe('high');
    expect(out.requiresHumanApproval).toBe(true);
    expect(out.recommendedActions.length).toBeGreaterThan(0);
    expect(out.confidence).toBeGreaterThan(0.5);
  });

  it('classifies medical reports as high-risk with human approval', () => {
    const out = extractIncidentFallback('Person collapsed in Section 114 row 12');
    expect(out.category).toBe('medical');
    expect(out.severity).toBe('critical');
    expect(out.locationId).toBe('section-114');
    expect(out.requiresHumanApproval).toBe(true);
    expect(HIGH_RISK_CATEGORIES).toContain(out.category);
  });

  it('detects elevator issues as accessibility outages', () => {
    const out = extractIncidentFallback('The north elevator is stuck and not moving');
    expect(out.category).toBe('accessibility_outage');
    expect(out.locationId).toBe('elevator-north');
  });

  it('falls back to other/low-confidence when unclassifiable', () => {
    const out = extractIncidentFallback('Something odd happened');
    expect(out.category).toBe('other');
    expect(out.confidence).toBeLessThan(0.5);
    expect(out.missingInformation.length).toBeGreaterThan(0);
  });

  it('honors an explicit location hint over detection', () => {
    const out = extractIncidentFallback('trash overflowing everywhere', 'food-court-1');
    expect(out.locationId).toBe('food-court-1');
    expect(out.category).toBe('waste_overflow');
  });
});

describe('duplicate detection', () => {
  const existing = [
    { category: 'crowd_congestion', locationId: 'gate-b', status: 'acknowledged' },
    { category: 'medical', locationId: 'section-114', status: 'resolved' },
  ] as const;

  it('blocks same category+location while unresolved', () => {
    expect(
      isDuplicateIncident([...existing], { category: 'crowd_congestion', locationId: 'gate-b' }),
    ).toBe(true);
  });

  it('allows a new report after the earlier one resolved', () => {
    expect(
      isDuplicateIncident([...existing], { category: 'medical', locationId: 'section-114' }),
    ).toBe(false);
  });

  it('allows same category at a different location', () => {
    expect(
      isDuplicateIncident([...existing], { category: 'crowd_congestion', locationId: 'gate-d' }),
    ).toBe(false);
  });
});

describe('announcement fallback', () => {
  const incident: Incident = {
    category: 'crowd_congestion',
    severity: 'high',
    summary: 'Queue at Gate B',
    locationId: 'gate-b',
    peopleAffectedEstimate: 100,
    accessibilityImpact: 'high',
    operationalImpact: 'high',
    recommendedTeam: 'crowd-operations',
    recommendedActions: [],
    requiresHumanApproval: true,
    missingInformation: [],
    confidence: 0.9,
    id: 'inc-test',
    status: 'acknowledged',
    reportedBy: 'volunteer',
    rawReport: 'x',
    createdAt: 0,
    updatedAt: 0,
    notes: [],
    provenance: 'fallback',
    approvedActions: [],
    rejectedActions: [],
  };

  it('produces all four languages with the location substituted', () => {
    const draft = draftAnnouncementFallback(incident);
    expect(draft.translations.map((t) => t.language)).toEqual(['en', 'es', 'fr', 'hi']);
    for (const tr of draft.translations) {
      expect(tr.text.length).toBeGreaterThan(20);
    }
    expect(draft.translations[0]?.text).toContain('Gate B');
  });
});
