import { describe, expect, it } from 'vitest';
import { sustainabilityFallback, transportAdvisoryFallback } from './advisories';
import { SustainabilityRecommendationSchema, TransportAdvisorySchema } from '../ai/schemas';
import type { SustainabilityState, TransportState } from '../types/domain';

function transportState(overrides: Partial<TransportState>): TransportState {
  return {
    load: {},
    metroStatus: 'normal',
    shuttleStatus: 'normal',
    advisories: [],
    ...overrides,
  };
}

function sustainabilityState(overrides: Partial<SustainabilityState>): SustainabilityState {
  return {
    wasteFill: {},
    energyUseKwh: 0,
    waterUseLiters: 0,
    alerts: [],
    ...overrides,
  };
}

describe('transportAdvisoryFallback', () => {
  it('produces schema-valid output for normal transport', () => {
    const out = transportAdvisoryFallback(transportState({}));
    expect(TransportAdvisorySchema.safeParse(out).success).toBe(true);
    expect(out.expectedDelayMinutes).toBe(0);
  });

  it('produces schema-valid output for an overloaded metro', () => {
    const out = transportAdvisoryFallback(transportState({ metroStatus: 'overloaded' }));
    const parsed = TransportAdvisorySchema.safeParse(out);
    expect(parsed.success).toBe(true);
    expect(out.recommendedExits.length).toBeGreaterThan(0);
    expect(out.expectedDelayMinutes).toBeGreaterThan(0);
  });

  it('produces schema-valid output for a suspended metro', () => {
    const out = transportAdvisoryFallback(transportState({ metroStatus: 'suspended' }));
    const parsed = TransportAdvisorySchema.safeParse(out);
    expect(parsed.success).toBe(true);
    expect(out.expectedDelayMinutes).toBe(45);
    expect(out.recommendedExits.length).toBeGreaterThan(0);
  });

  it('produces schema-valid output for a delayed metro', () => {
    const out = transportAdvisoryFallback(transportState({ metroStatus: 'delayed' }));
    expect(TransportAdvisorySchema.safeParse(out).success).toBe(true);
  });
});

describe('sustainabilityFallback', () => {
  it('produces schema-valid output for low waste levels', () => {
    const out = sustainabilityFallback(sustainabilityState({ wasteFill: { 'bin-1': 0.2 } }));
    const parsed = SustainabilityRecommendationSchema.safeParse(out);
    expect(parsed.success).toBe(true);
    expect(out.actions.length).toBeGreaterThan(0);
  });

  it('produces schema-valid output when a waste point exceeds 80% fill', () => {
    const out = sustainabilityFallback(
      sustainabilityState({ wasteFill: { 'bin-1': 0.9, 'bin-2': 0.3 } }),
    );
    const parsed = SustainabilityRecommendationSchema.safeParse(out);
    expect(parsed.success).toBe(true);
    expect(out.headline).toContain('1');
    expect(out.actions.length).toBeGreaterThan(0);
  });

  it('produces schema-valid output when waste points are approaching capacity', () => {
    const out = sustainabilityFallback(sustainabilityState({ wasteFill: { 'bin-1': 0.7 } }));
    const parsed = SustainabilityRecommendationSchema.safeParse(out);
    expect(parsed.success).toBe(true);
  });
});
