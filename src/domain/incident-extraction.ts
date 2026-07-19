/**
 * StadiumPulse AI — deterministic incident extraction (fallback path).
 * Original StadiumPulse AI code.
 *
 * When Gemini is unavailable this rule-based extractor produces the same
 * IncidentExtraction shape. It is intentionally conservative: anything it
 * cannot classify is 'other' with low confidence and human review required.
 */

import type {
  ImpactLevel,
  IncidentCategory,
  IncidentExtraction,
  IncidentSeverity,
  TeamId,
} from '../types/domain';
import { HIGH_RISK_CATEGORIES } from '../types/domain';
import { STADIUM_GRAPH } from '../data/stadium-graph';

interface CategoryRule {
  category: IncidentCategory;
  pattern: RegExp;
  team: TeamId;
  severity: IncidentSeverity;
  actions: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'medical',
    pattern: /collaps|unconscious|faint|injur|bleed|heart|seizure|medical|first aid|hurt|breathing/i,
    team: 'medical-response',
    severity: 'critical',
    actions: ['Dispatch first-aid team', 'Keep surrounding aisles clear'],
  },
  {
    category: 'fire',
    pattern: /fire|smoke|burning|flames/i,
    team: 'security',
    severity: 'critical',
    actions: ['Alert fire response team', 'Prepare local evacuation guidance'],
  },
  {
    category: 'missing_person',
    pattern: /missing|lost (child|kid|boy|girl|son|daughter|person)|can.?t find (my|their)/i,
    team: 'security',
    severity: 'critical',
    actions: ['Notify all gate teams with description', 'Review nearby camera feeds'],
  },
  {
    category: 'violence',
    pattern: /fight|violen|assault|attack|aggressive/i,
    team: 'security',
    severity: 'high',
    actions: ['Send security team to de-escalate', 'Separate involved parties'],
  },
  {
    category: 'security',
    pattern: /suspicious|unattended (bag|package)|threat|weapon/i,
    team: 'security',
    severity: 'high',
    actions: ['Send security to assess', 'Establish a safety perimeter'],
  },
  {
    category: 'structural',
    pattern: /crack|collapse risk|railing (broken|loose)|structural|ceiling/i,
    team: 'facilities-maintenance',
    severity: 'high',
    actions: ['Close off the affected area', 'Send structural inspection team'],
  },
  {
    category: 'crowd_congestion',
    pattern: /queue|crowd|congest|crush|blocked|bottleneck|packed|jammed|can.?t move/i,
    team: 'crowd-operations',
    severity: 'high',
    actions: ['Redirect flow to an alternative route', 'Deploy volunteers to manage the queue'],
  },
  {
    category: 'accessibility_outage',
    pattern: /elevator|lift|escalator|ramp (blocked|broken)|wheelchair.*(stuck|blocked|cannot)/i,
    team: 'facilities-maintenance',
    severity: 'medium',
    actions: ['Dispatch maintenance technician', 'Signpost the nearest step-free alternative'],
  },
  {
    category: 'waste_overflow',
    pattern: /trash|waste|garbage|bin|litter|overflow|spill/i,
    team: 'sustainability',
    severity: 'medium',
    actions: ['Dispatch cleanup crew', 'Open auxiliary bins nearby'],
  },
  {
    category: 'transport_disruption',
    pattern: /metro|shuttle|train|bus|platform|transport/i,
    team: 'transport-coordination',
    severity: 'medium',
    actions: ['Coordinate with transport operator', 'Update exit guidance for fans'],
  },
  {
    category: 'weather',
    pattern: /heat|hot|sun|dizzy|dehydrat|rain|storm|lightning|wind/i,
    team: 'guest-services',
    severity: 'medium',
    actions: ['Announce hydration guidance', 'Open shaded or cooled areas'],
  },
  {
    category: 'facility_issue',
    pattern: /restroom|toilet|water (station|fountain)|leak|broken|out of (order|service)|door/i,
    team: 'facilities-maintenance',
    severity: 'low',
    actions: ['Send maintenance to inspect', 'Signpost the nearest alternative facility'],
  },
];

/** Node keyword index for location detection. */
const LOCATION_PATTERNS: { pattern: RegExp; nodeId: string }[] = [
  ...Object.values(STADIUM_GRAPH.nodes)
    .filter((n) => n.kind === 'seating_entrance')
    .map((n) => ({
      pattern: new RegExp(`section\\s*${n.id.replace('section-', '')}`, 'i'),
      nodeId: n.id,
    })),
  ...['a', 'b', 'c', 'd', 'e', 'f'].map((g) => ({
    pattern: new RegExp(`gate\\s*${g}\\b`, 'i'),
    nodeId: `gate-${g}`,
  })),
  { pattern: /food court\s*1|north food/i, nodeId: 'food-court-1' },
  { pattern: /food court\s*2|south food|food court/i, nodeId: 'food-court-2' },
  { pattern: /north elevator/i, nodeId: 'elevator-north' },
  { pattern: /south elevator/i, nodeId: 'elevator-south' },
  { pattern: /elevator|lift/i, nodeId: 'elevator-north' },
  { pattern: /metro|train|platform/i, nodeId: 'metro-point' },
  { pattern: /shuttle|bus/i, nodeId: 'shuttle-point' },
  { pattern: /medical room|first aid/i, nodeId: 'medical-room' },
  { pattern: /quiet room/i, nodeId: 'quiet-room' },
];

function detectLocation(text: string): string | null {
  for (const { pattern, nodeId } of LOCATION_PATTERNS) {
    if (pattern.test(text)) return nodeId;
  }
  return null;
}

function detectPeople(text: string): number {
  const m = /(\d{1,4})\s*(people|persons|fans|folks)/i.exec(text);
  if (m?.[1]) return Number(m[1]);
  if (/hundreds|huge|massive/i.test(text)) return 150;
  if (/dozens|many|lots/i.test(text)) return 40;
  if (/few|couple|some/i.test(text)) return 5;
  return 1;
}

function accessibilityImpactFor(category: IncidentCategory, text: string): ImpactLevel {
  if (category === 'accessibility_outage') return 'high';
  if (/wheelchair|accessib|disabled|mobility/i.test(text)) return 'high';
  if (category === 'crowd_congestion') return 'medium';
  return 'none';
}

export function extractIncidentFallback(
  rawReport: string,
  locationHint?: string,
): IncidentExtraction {
  const rule = CATEGORY_RULES.find((r) => r.pattern.test(rawReport));
  const category = rule?.category ?? 'other';
  const location = locationHint ?? detectLocation(rawReport);
  const missing: string[] = [];
  if (!location) missing.push('Exact location of the incident');
  if (!rule) missing.push('Clear incident category');

  const severity: IncidentSeverity = rule?.severity ?? 'medium';
  const highRisk = HIGH_RISK_CATEGORIES.includes(category);
  const summaryBase = rawReport.trim().replace(/\s+/g, ' ').slice(0, 140);

  return {
    category,
    severity,
    summary: summaryBase.length > 0 ? summaryBase : 'Unspecified incident report',
    locationId: location ?? 'assistance-desk-a',
    peopleAffectedEstimate: detectPeople(rawReport),
    accessibilityImpact: accessibilityImpactFor(category, rawReport),
    operationalImpact:
      severity === 'critical' || severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
    recommendedTeam: rule?.team ?? 'guest-services',
    recommendedActions: rule?.actions ?? ['Send a staff member to assess the situation'],
    requiresHumanApproval: highRisk || severity === 'high' || severity === 'critical',
    missingInformation: missing,
    confidence: rule ? (location ? 0.75 : 0.6) : 0.35,
  };
}

/**
 * Duplicate guard: same category at the same location while an earlier report
 * is still unresolved counts as a duplicate.
 */
export function isDuplicateIncident(
  existing: { category: IncidentCategory; locationId: string; status: string }[],
  candidate: Pick<IncidentExtraction, 'category' | 'locationId'>,
): boolean {
  return existing.some(
    (i) =>
      i.category === candidate.category &&
      i.locationId === candidate.locationId &&
      i.status !== 'resolved' &&
      i.status !== 'rejected',
  );
}
