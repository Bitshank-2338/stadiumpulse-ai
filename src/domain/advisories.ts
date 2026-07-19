/**
 * StadiumPulse AI — deterministic transport/sustainability advisory fallbacks.
 * Original StadiumPulse AI code.
 *
 * Template-based advisories used when Gemini is unavailable. Gemini
 * (Milestone 6/7) produces richer text validated against the same shape.
 */

import type { z } from 'zod';
import type {
  SustainabilityRecommendationSchema,
  TransportAdvisorySchema,
} from '../ai/schemas';
import type { SustainabilityState, TransportState } from '../types/domain';

type TransportAdvisoryOut = z.infer<typeof TransportAdvisorySchema>;
type SustainabilityRecommendationOut = z.infer<typeof SustainabilityRecommendationSchema>;

const METRO_DELAY_MINUTES: Record<TransportState['metroStatus'], number> = {
  normal: 0,
  delayed: 10,
  overloaded: 20,
  suspended: 45,
};

export function transportAdvisoryFallback(transport: TransportState): TransportAdvisoryOut {
  const { metroStatus, shuttleStatus, advisories } = transport;

  if (metroStatus === 'suspended') {
    return {
      headline: 'Metro service suspended — use shuttles or walking exits',
      advisory:
        'The metro is currently suspended. Please use the shuttle service or walk to an alternative exit. Follow staff guidance at all times.',
      recommendedExits: ['Gate B', 'Gate C'],
      expectedDelayMinutes: METRO_DELAY_MINUTES.suspended,
    };
  }

  if (metroStatus === 'overloaded') {
    return {
      headline: 'Metro station overloaded — consider the shuttle instead',
      advisory:
        'The metro station is experiencing heavy overcrowding. Extra shuttles are running from the shuttle stop near Gate C. Please consider exiting via Gates B or C to avoid the crowding.',
      recommendedExits: ['Gate B', 'Gate C'],
      expectedDelayMinutes: METRO_DELAY_MINUTES.overloaded,
    };
  }

  if (metroStatus === 'delayed') {
    return {
      headline: 'Metro delays in effect',
      advisory:
        'The metro is running with delays. Shuttle service is available as an alternative if you are in a hurry.',
      recommendedExits: shuttleStatus === 'boosted' ? ['Gate C'] : [],
      expectedDelayMinutes: METRO_DELAY_MINUTES.delayed,
    };
  }

  return {
    headline: 'Transport running normally',
    advisory:
      advisories.length > 0
        ? `Metro and shuttle services are operating normally. ${advisories[0]}`
        : 'Metro and shuttle services are operating normally. No advisories at this time.',
    recommendedExits: [],
    expectedDelayMinutes: METRO_DELAY_MINUTES.normal,
  };
}

export function sustainabilityFallback(
  sustainability: SustainabilityState,
): SustainabilityRecommendationOut {
  const fillEntries = Object.entries(sustainability.wasteFill);
  const overflowing = fillEntries.filter(([, fill]) => fill > 0.8);
  const filling = fillEntries.filter(([, fill]) => fill > 0.6 && fill <= 0.8);

  if (overflowing.length > 0) {
    return {
      headline: `Waste collection needed at ${overflowing.length} location(s)`,
      explanation:
        'One or more waste points are above 80% capacity. Overflow risks litter and blocked walkways. Dispatch cleaning crews now and direct fans to nearby bins with spare capacity.',
      actions: [
        'Dispatch cleaning crew to the overflowing waste points',
        'Place temporary overflow bins nearby',
        'Redirect fans to bins with spare capacity',
        ...(sustainability.alerts.length > 0 ? [sustainability.alerts[0] ?? ''] : []),
      ].filter((a) => a.length > 0),
    };
  }

  if (filling.length > 0) {
    return {
      headline: `${filling.length} waste point(s) approaching capacity`,
      explanation:
        'Some waste points are filling up but not yet critical. Scheduling a collection round now will prevent overflow later in the event.',
      actions: [
        'Schedule a collection round for the filling waste points',
        'Monitor fill levels over the next hour',
      ],
    };
  }

  return {
    headline: 'Sustainability metrics within normal range',
    explanation:
      'Waste levels are low across the venue and no action is required right now. Continue routine monitoring.',
    actions: ['Continue routine monitoring of waste and utility levels'],
  };
}
