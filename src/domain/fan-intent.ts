/**
 * StadiumPulse AI — deterministic fan-intent interpreter.
 * Original StadiumPulse AI code.
 *
 * This is the guaranteed fallback path: when Gemini is unavailable, natural
 * language requests still resolve via keyword rules. Gemini (Milestone 6)
 * produces the same FanIntent shape, validated by the same schema.
 */

import type { AccessibilityPreferences, RoutingMode } from '../types/domain';
import { STADIUM_GRAPH } from '../data/stadium-graph';

export interface FanIntent {
  kind:
    | 'route_to_section'
    | 'route_to_node'
    | 'find_facility'
    | 'least_crowded_gate'
    | 'emergency_assistance'
    | 'unknown';
  /** e.g. 'section-315' or a facility/gate node id. */
  targetNodeId?: string;
  facilityKinds?: string[];
  mode: RoutingMode;
  /** Echo of what was understood, for transparency. */
  understood: string;
}

function modeFromText(
  text: string,
  prefs: AccessibilityPreferences,
): RoutingMode {
  const t = text.toLowerCase();
  if (/without stairs|no stairs|step[- ]free|wheelchair/.test(t)) return 'step_free';
  if (/avoid.*escalator/.test(t)) return 'avoid_escalators';
  if (/avoid.*stairs/.test(t)) return 'avoid_stairs';
  if (/quiet|loud|noise|sensory|overwhelm/.test(t)) return 'reduced_sensory';
  if (/least crowded|less crowded|avoid crowd|quickest/.test(t)) return 'least_crowded';
  if (prefs.wheelchair || prefs.stepFree) return 'step_free';
  if (prefs.reducedSensory) return 'reduced_sensory';
  return 'shortest';
}

export function interpretFanRequest(
  text: string,
  prefs: AccessibilityPreferences,
): FanIntent {
  const t = text.toLowerCase();
  const mode = modeFromText(text, prefs);

  // Section routing, e.g. "section 315", "seat in 114"
  const sectionMatch = /section\s*(\d{3})|(?:to|in)\s+(\d{3})\b/.exec(t);
  const sectionNum = sectionMatch?.[1] ?? sectionMatch?.[2];
  if (sectionNum) {
    const nodeId = `section-${sectionNum}`;
    if (STADIUM_GRAPH.nodes[nodeId]) {
      return {
        kind: 'route_to_section',
        targetNodeId: nodeId,
        mode,
        understood: `Route to Section ${sectionNum} (${mode.replace(/_/g, ' ')})`,
      };
    }
    return {
      kind: 'unknown',
      mode,
      understood: `Section ${sectionNum} is not in this stadium model. Available sections: 114, 127, 315, 332.`,
    };
  }

  // Emergency must be checked before facility rules: "medical emergency"
  // would otherwise be swallowed by the first-aid /medic/ keyword match.
  if (/emergency|urgent help|need help|help me|lost (my )?(child|kid|son|daughter)|missing/.test(t)) {
    return { kind: 'emergency_assistance', mode, understood: 'Emergency assistance request' };
  }

  if (/least crowded (gate|entrance)|which (gate|entrance)/.test(t)) {
    return {
      kind: 'least_crowded_gate',
      mode: 'least_crowded',
      understood: 'Find the least crowded gate',
    };
  }

  if (/metro|train|subway/.test(t)) {
    return {
      kind: 'route_to_node',
      targetNodeId: 'metro-point',
      mode,
      understood: 'Route to the metro station',
    };
  }
  if (/shuttle|bus/.test(t)) {
    return {
      kind: 'route_to_node',
      targetNodeId: 'shuttle-point',
      mode,
      understood: 'Route to the shuttle stop',
    };
  }

  if (/accessible (rest|bath|toilet)|disabled (rest|toilet)/.test(t)) {
    return {
      kind: 'find_facility',
      facilityKinds: ['accessible_restroom'],
      mode: mode === 'shortest' ? 'step_free' : mode,
      understood: 'Nearest accessible restroom',
    };
  }
  if (/rest ?room|bathroom|toilet|washroom/.test(t)) {
    const wantsAccessible = prefs.wheelchair || prefs.accessibleRestroomPriority;
    return {
      kind: 'find_facility',
      facilityKinds: wantsAccessible ? ['accessible_restroom'] : ['restroom', 'accessible_restroom'],
      mode,
      understood: wantsAccessible ? 'Nearest accessible restroom (per your preferences)' : 'Nearest restroom',
    };
  }
  if (/water|refill|drink|thirsty|hydrat/.test(t)) {
    return { kind: 'find_facility', facilityKinds: ['water_station'], mode, understood: 'Nearest water refill station' };
  }
  if (/food|eat|hungry|snack|taco|burger/.test(t)) {
    return { kind: 'find_facility', facilityKinds: ['food_court'], mode, understood: 'Food court with shortest queue' };
  }
  if (/first aid|medic|hurt|injur|doctor|nurse/.test(t)) {
    return { kind: 'find_facility', facilityKinds: ['medical_room'], mode, understood: 'Nearest first-aid point' };
  }
  if (/quiet room|calm|quiet space|sensory room/.test(t)) {
    return { kind: 'find_facility', facilityKinds: ['quiet_room'], mode, understood: 'Quiet room' };
  }
  if (/help desk|assistance|staff|volunteer/.test(t)) {
    return { kind: 'find_facility', facilityKinds: ['assistance_desk'], mode, understood: 'Nearest assistance desk' };
  }
  if (/exit|leave|way out/.test(t)) {
    return {
      kind: 'least_crowded_gate',
      mode: 'least_crowded',
      understood: 'Least crowded exit',
    };
  }

  return {
    kind: 'unknown',
    mode,
    understood:
      'I could not match that to a stadium destination. Try a section number (e.g. 315), restroom, water, food, first aid, quiet room, metro or shuttle.',
  };
}
