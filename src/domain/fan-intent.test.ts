import { describe, expect, it } from 'vitest';
import { interpretFanRequest } from './fan-intent';
import { DEFAULT_PREFERENCES } from '../types/domain';
import { STADIUM_GRAPH } from '../data/stadium-graph';

// Every target node/facility id asserted below is checked against the real
// stadium graph so these tests fail if the data model and interpreter drift.
function nodeExists(id: string): boolean {
  return STADIUM_GRAPH.nodes[id] !== undefined;
}

function facilityKindExists(kind: string): boolean {
  return Object.values(STADIUM_GRAPH.nodes).some((n) => n.facilityKind === kind);
}

describe('interpretFanRequest — section routing', () => {
  it('resolves "take me to section 315 without stairs" to the section with step-free mode', () => {
    const intent = interpretFanRequest('take me to section 315 without stairs', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('route_to_section');
    expect(intent.targetNodeId).toBe('section-315');
    expect(nodeExists(intent.targetNodeId as string)).toBe(true);
    expect(intent.mode).toBe('step_free');
  });

  it('resolves a plain seat request "find section 114"', () => {
    const intent = interpretFanRequest('find section 114', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('route_to_section');
    expect(intent.targetNodeId).toBe('section-114');
    expect(nodeExists(intent.targetNodeId as string)).toBe(true);
    expect(intent.mode).toBe('shortest');
  });

  it('returns unknown with helpful guidance for a section not in the graph', () => {
    const intent = interpretFanRequest('section 999', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('unknown');
    expect(intent.targetNodeId).toBeUndefined();
    expect(intent.understood).toMatch(/not in this stadium model/i);
  });

  it('is case-insensitive for section requests', () => {
    const intent = interpretFanRequest('TAKE ME TO SECTION 315 WITHOUT STAIRS', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('route_to_section');
    expect(intent.targetNodeId).toBe('section-315');
    expect(intent.mode).toBe('step_free');
  });
});

describe('interpretFanRequest — facility requests', () => {
  it('finds a restroom (non-accessible-priority preferences)', () => {
    const intent = interpretFanRequest('where is the nearest restroom', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('find_facility');
    expect(intent.facilityKinds).toEqual(['restroom', 'accessible_restroom']);
    for (const k of intent.facilityKinds ?? []) expect(facilityKindExists(k)).toBe(true);
  });

  it('finds an accessible restroom when explicitly requested', () => {
    const intent = interpretFanRequest('accessible restroom please', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('find_facility');
    expect(intent.facilityKinds).toEqual(['accessible_restroom']);
    expect(facilityKindExists('accessible_restroom')).toBe(true);
    // Facility requests for accessible restroom upgrade a default "shortest" mode to step_free.
    expect(intent.mode).toBe('step_free');
  });

  it('prioritizes accessible restroom for a wheelchair user asking for any restroom', () => {
    const intent = interpretFanRequest('bathroom', { ...DEFAULT_PREFERENCES, wheelchair: true });
    expect(intent.kind).toBe('find_facility');
    expect(intent.facilityKinds).toEqual(['accessible_restroom']);
  });

  it('finds a water station', () => {
    const intent = interpretFanRequest('I need water, I am thirsty', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('find_facility');
    expect(intent.facilityKinds).toEqual(['water_station']);
    expect(facilityKindExists('water_station')).toBe(true);
  });

  it('finds food', () => {
    const intent = interpretFanRequest('where can I get food, I am hungry', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('find_facility');
    expect(intent.facilityKinds).toEqual(['food_court']);
    expect(facilityKindExists('food_court')).toBe(true);
  });

  it('finds first aid', () => {
    const intent = interpretFanRequest('I need a doctor', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('find_facility');
    expect(intent.facilityKinds).toEqual(['medical_room']);
    expect(facilityKindExists('medical_room')).toBe(true);
  });

  it('finds a quiet room', () => {
    const intent = interpretFanRequest('is there a quiet room somewhere', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('find_facility');
    expect(intent.facilityKinds).toEqual(['quiet_room']);
    expect(facilityKindExists('quiet_room')).toBe(true);
  });

  it('is case-insensitive for facility requests', () => {
    const intent = interpretFanRequest('WHERE CAN I GET FOOD', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('find_facility');
    expect(intent.facilityKinds).toEqual(['food_court']);
  });
});

describe('interpretFanRequest — gates, metro, exit', () => {
  it('finds the least crowded gate', () => {
    const intent = interpretFanRequest('which gate should I use', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('least_crowded_gate');
    expect(intent.mode).toBe('least_crowded');
  });

  it('routes to the metro station', () => {
    const intent = interpretFanRequest('how do I get to the metro', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('route_to_node');
    expect(intent.targetNodeId).toBe('metro-point');
    expect(nodeExists(intent.targetNodeId as string)).toBe(true);
  });

  it('routes to the exit via the least crowded gate', () => {
    const intent = interpretFanRequest('where is the exit', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('least_crowded_gate');
    expect(intent.mode).toBe('least_crowded');
  });
});

describe('interpretFanRequest — emergency phrasing', () => {
  it('treats a direct emergency statement as emergency_assistance', () => {
    const intent = interpretFanRequest('this is an emergency', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('emergency_assistance');
  });

  it('treats a missing-child report as emergency_assistance', () => {
    const intent = interpretFanRequest('my child is missing', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('emergency_assistance');
  });

  // Regression tests: these two phrasings were originally misrouted — bare
  // "help" matched no rule (fell through to 'unknown'), and the first-aid
  // /medic/ keyword swallowed "medical emergency" before the emergency rule
  // ran. The emergency check now runs before the facility rules and also
  // matches "need help" / "help me".
  it('treats "I need help" as emergency_assistance', () => {
    const intent = interpretFanRequest('I need help', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('emergency_assistance');
  });

  it('treats "medical emergency" as emergency_assistance, not a routine first-aid lookup', () => {
    const intent = interpretFanRequest('medical emergency', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('emergency_assistance');
  });
});

describe('interpretFanRequest — unknown input', () => {
  it('returns a safe unknown result for gibberish, with no target and a helpful message', () => {
    const intent = interpretFanRequest('asdkjqwoeiuzxpqr blorptastic', DEFAULT_PREFERENCES);
    expect(intent.kind).toBe('unknown');
    expect(intent.targetNodeId).toBeUndefined();
    expect(intent.facilityKinds).toBeUndefined();
    expect(intent.understood.length).toBeGreaterThan(0);
    // mode still resolves to a valid RoutingMode even when nothing matched.
    expect(intent.mode).toBe('shortest');
  });
});

describe('interpretFanRequest — accessibility preference fallback', () => {
  it('defaults to step_free mode from preferences alone when text has no mode keywords', () => {
    const intent = interpretFanRequest('find section 114', { ...DEFAULT_PREFERENCES, wheelchair: true });
    expect(intent.mode).toBe('step_free');
  });

  it('defaults to reduced_sensory mode from preferences alone when text has no mode keywords', () => {
    const intent = interpretFanRequest('find section 114', { ...DEFAULT_PREFERENCES, reducedSensory: true });
    expect(intent.mode).toBe('reduced_sensory');
  });
});
