import { describe, expect, it } from 'vitest';
import {
  AnnouncementSchema,
  FanIntentSchema,
  IncidentExtractionSchema,
  SituationBriefSchema,
} from './schemas';

describe('IncidentExtractionSchema', () => {
  const valid = {
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

  it('accepts the spec example', () => {
    expect(IncidentExtractionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown categories', () => {
    expect(
      IncidentExtractionSchema.safeParse({ ...valid, category: 'alien_invasion' }).success,
    ).toBe(false);
  });

  it('rejects out-of-range confidence', () => {
    expect(IncidentExtractionSchema.safeParse({ ...valid, confidence: 1.4 }).success).toBe(false);
  });

  it('rejects empty recommendedActions', () => {
    expect(
      IncidentExtractionSchema.safeParse({ ...valid, recommendedActions: [] }).success,
    ).toBe(false);
  });
});

describe('AnnouncementSchema', () => {
  it('requires exactly four translations', () => {
    const three = {
      title: 'Gate update',
      translations: [
        { language: 'en', text: 'Please use Gate D for faster entry.' },
        { language: 'es', text: 'Utilice la Puerta D para entrar más rápido.' },
        { language: 'fr', text: 'Veuillez utiliser la Porte D pour entrer plus vite.' },
      ],
    };
    expect(AnnouncementSchema.safeParse(three).success).toBe(false);
    const four = {
      ...three,
      translations: [
        ...three.translations,
        { language: 'hi', text: 'तेज़ प्रवेश के लिए कृपया गेट D का उपयोग करें।' },
      ],
    };
    expect(AnnouncementSchema.safeParse(four).success).toBe(true);
  });
});

describe('FanIntentSchema', () => {
  it('accepts a minimal valid intent', () => {
    expect(
      FanIntentSchema.safeParse({
        kind: 'find_facility',
        facilityKinds: ['restroom'],
        mode: 'step_free',
        understood: 'Nearest accessible restroom',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid mode', () => {
    expect(
      FanIntentSchema.safeParse({
        kind: 'find_facility',
        mode: 'teleport',
        understood: 'x?',
      }).success,
    ).toBe(false);
  });
});

describe('SituationBriefSchema', () => {
  it('requires at least one observed fact', () => {
    expect(
      SituationBriefSchema.safeParse({
        headline: 'All calm',
        situation: 'Nothing significant to report at this time.',
        observedFacts: [],
        predictions: [],
        recommendedPriorities: ['Monitor'],
        requiresOperatorDecision: [],
      }).success,
    ).toBe(false);
  });
});
