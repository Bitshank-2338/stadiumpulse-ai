/**
 * StadiumPulse AI — deterministic stadium health score.
 * Original StadiumPulse AI code. Gemini never computes this.
 */

import type {
  CrowdMap,
  FacilityState,
  HealthBreakdown,
  Incident,
  SustainabilityState,
  TransportState,
} from '../types/domain';

const SEVERITY_PENALTY: Record<Incident['severity'], number> = {
  low: 4,
  medium: 9,
  high: 16,
  critical: 28,
};

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeHealth(input: {
  crowd: CrowdMap;
  incidents: Incident[];
  facilities: Record<string, FacilityState>;
  transport: TransportState;
  sustainability: SustainabilityState;
}): HealthBreakdown {
  const zones = Object.values(input.crowd);
  const avgCrowd = zones.length
    ? zones.reduce((a, b) => a + b, 0) / zones.length
    : 0;
  const maxCrowd = zones.length ? Math.max(...zones) : 0;
  const crowd = clamp01to100(100 - avgCrowd * 60 - Math.max(0, maxCrowd - 0.7) * 100);

  const open = input.incidents.filter(
    (i) => i.status !== 'resolved' && i.status !== 'rejected',
  );
  const incidentPenalty = open.reduce(
    (sum, i) => sum + SEVERITY_PENALTY[i.severity],
    0,
  );
  const incidents = clamp01to100(100 - incidentPenalty);

  const outages = Object.values(input.facilities).filter(
    (f) => f.status === 'outage',
  ).length;
  const closed = Object.values(input.facilities).filter(
    (f) => f.status === 'closed',
  ).length;
  const accessibility = clamp01to100(100 - outages * 22 - closed * 8);

  const loads = Object.values(input.transport.load);
  const maxLoad = loads.length ? Math.max(...loads) : 0;
  const transportBase =
    input.transport.metroStatus === 'suspended'
      ? 30
      : input.transport.metroStatus === 'overloaded'
        ? 55
        : input.transport.metroStatus === 'delayed'
          ? 75
          : 95;
  const transport = clamp01to100(transportBase - Math.max(0, maxLoad - 0.75) * 60);

  const fills = Object.values(input.sustainability.wasteFill);
  const worstFill = fills.length ? Math.max(...fills) : 0;
  const sustainability = clamp01to100(
    100 - Math.max(0, worstFill - 0.7) * 160 - input.sustainability.alerts.length * 6,
  );

  const overall = clamp01to100(
    crowd * 0.28 +
      incidents * 0.3 +
      accessibility * 0.16 +
      transport * 0.14 +
      sustainability * 0.12,
  );

  return { overall, crowd, incidents, accessibility, transport, sustainability };
}
