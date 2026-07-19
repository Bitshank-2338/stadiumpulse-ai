/**
 * StadiumPulse AI — deterministic scenario engine.
 * Original StadiumPulse AI code. Each scenario is a full, reproducible state
 * package applied through store actions; reset restores the baseline snapshot.
 */

import type {
  CrowdMap,
  FacilityState,
  IncidentExtraction,
  ScenarioId,
  SustainabilityState,
  TransportState,
} from '../types/domain';
import { ALL_ZONE_IDS, STADIUM_GRAPH } from '../data/stadium-graph';
import type { BaselineSnapshot, StadiumStore } from '../store/stadium-store';

export interface ScenarioDefinition {
  id: ScenarioId;
  title: string;
  description: string;
  crowd: CrowdMap;
  facilityOverrides: Record<string, Partial<FacilityState>>;
  transport: TransportState;
  sustainability: SustainabilityState;
  seededIncidents: { extraction: IncidentExtraction; rawReport: string }[];
}

function baseCrowd(level: number): CrowdMap {
  const crowd: CrowdMap = {};
  for (const z of ALL_ZONE_IDS) crowd[z] = level;
  return crowd;
}

function baseFacilities(): Record<string, FacilityState> {
  const out: Record<string, FacilityState> = {};
  for (const node of Object.values(STADIUM_GRAPH.nodes)) {
    if (node.facilityKind !== undefined || node.kind === 'elevator') {
      out[node.id] = { nodeId: node.id, status: 'open', queueLoad: 0.2 };
    }
  }
  return out;
}

function baseTransport(): TransportState {
  return {
    load: { 'metro-point': 0.35, 'shuttle-point': 0.25 },
    metroStatus: 'normal',
    shuttleStatus: 'normal',
    advisories: [],
  };
}

function baseSustainability(): SustainabilityState {
  return {
    wasteFill: { 'food-court-1': 0.35, 'food-court-2': 0.4 },
    energyUseKwh: 4200,
    waterUseLiters: 61000,
    alerts: [],
  };
}

const inc = (partial: Partial<IncidentExtraction> & Pick<IncidentExtraction, 'category' | 'severity' | 'summary' | 'locationId' | 'recommendedTeam'>): IncidentExtraction => ({
  peopleAffectedEstimate: 0,
  accessibilityImpact: 'none',
  operationalImpact: 'low',
  recommendedActions: [],
  requiresHumanApproval: false,
  missingInformation: [],
  confidence: 1,
  ...partial,
});

export function buildScenario(id: ScenarioId): ScenarioDefinition {
  const crowd = baseCrowd(0.3);
  const facilityOverrides: Record<string, Partial<FacilityState>> = {};
  const transport = baseTransport();
  const sustainability = baseSustainability();
  const seededIncidents: ScenarioDefinition['seededIncidents'] = [];
  let title = '';
  let description = '';

  switch (id) {
    case 'normal_match_day':
      title = 'Normal match day';
      description = 'Steady inbound flow, all systems nominal.';
      break;

    case 'gate_b_surge': {
      title = 'Gate B crowd surge';
      description = 'Dense queue at Gate B blocks the concourse; accessible lane compromised.';
      crowd['gate-b-plaza'] = 0.95;
      crowd['gate-b-concourse'] = 0.88;
      crowd['gate-a-concourse'] = 0.55;
      seededIncidents.push({
        extraction: inc({
          category: 'crowd_congestion',
          severity: 'high',
          summary: 'Dense queue blocking movement near Gate B',
          locationId: 'concourse-b',
          peopleAffectedEstimate: 140,
          accessibilityImpact: 'high',
          operationalImpact: 'high',
          recommendedTeam: 'crowd-operations',
          recommendedActions: [
            'Redirect general entry toward Gate D',
            'Deploy volunteers to establish a protected accessible lane',
          ],
          requiresHumanApproval: true,
          confidence: 0.92,
        }),
        rawReport:
          'A huge queue is forming near Gate B and wheelchair users cannot move through the corridor.',
      });
      break;
    }

    case 'elevator_outage': {
      title = 'North elevator outage';
      description = 'North elevator is out of service; step-free routes to the upper tier reroute south.';
      facilityOverrides['elevator-north'] = { status: 'outage' };
      seededIncidents.push({
        extraction: inc({
          category: 'accessibility_outage',
          severity: 'medium',
          summary: 'North elevator out of service — step-free access to upper tier impacted',
          locationId: 'elevator-north',
          peopleAffectedEstimate: 40,
          accessibilityImpact: 'high',
          operationalImpact: 'medium',
          recommendedTeam: 'facilities-maintenance',
          recommendedActions: [
            'Dispatch maintenance technician to the north elevator',
            'Signpost the south elevator as the step-free alternative',
          ],
          confidence: 0.95,
        }),
        rawReport: 'North elevator has stopped between floors, no passengers inside.',
      });
      break;
    }

    case 'missing_child': {
      title = 'Missing child';
      description = 'A child is separated from their family near Food Court 1.';
      seededIncidents.push({
        extraction: inc({
          category: 'missing_person',
          severity: 'critical',
          summary: 'Child (approx. 7) separated from family near Food Court 1',
          locationId: 'food-court-1',
          peopleAffectedEstimate: 1,
          accessibilityImpact: 'none',
          operationalImpact: 'high',
          recommendedTeam: 'security',
          recommendedActions: [
            'Notify all gate teams with description',
            'Review concourse camera feeds near Food Court 1',
            'Station a staff member with the family at the assistance desk',
          ],
          requiresHumanApproval: true,
          confidence: 0.88,
        }),
        rawReport:
          'A parent reports their 7-year-old wandered off near the north food court a few minutes ago.',
      });
      break;
    }

    case 'medical_section_114': {
      title = 'Medical incident in Section 114';
      description = 'A spectator collapsed in Section 114; aisles must stay clear.';
      crowd['gate-a-concourse'] = 0.6;
      seededIncidents.push({
        extraction: inc({
          category: 'medical',
          severity: 'critical',
          summary: 'Spectator collapsed in Section 114, conscious but needs assistance',
          locationId: 'section-114',
          peopleAffectedEstimate: 1,
          accessibilityImpact: 'medium',
          operationalImpact: 'medium',
          recommendedTeam: 'medical-response',
          recommendedActions: [
            'Dispatch first-aid team from the medical room',
            'Keep the Section 114 aisle clear for stretcher access',
          ],
          requiresHumanApproval: true,
          confidence: 0.9,
        }),
        rawReport: 'Person collapsed in section 114 around row 12, crowd gathering.',
      });
      break;
    }

    case 'metro_overload': {
      title = 'Metro overload';
      description = 'Post-match metro crush; shuttles boosted and exits rebalanced.';
      transport.load = { 'metro-point': 0.96, 'shuttle-point': 0.5 };
      transport.metroStatus = 'overloaded';
      transport.shuttleStatus = 'boosted';
      transport.advisories = [
        'Metro platform at capacity — expect 25 minute delays',
        'Extra shuttles running from the east shuttle stop',
      ];
      crowd['transport-west'] = 0.92;
      crowd['gate-e-concourse'] = 0.7;
      crowd['gate-d-concourse'] = 0.65;
      seededIncidents.push({
        extraction: inc({
          category: 'transport_disruption',
          severity: 'high',
          summary: 'Metro platform overloaded after final whistle',
          locationId: 'metro-point',
          peopleAffectedEstimate: 900,
          accessibilityImpact: 'medium',
          operationalImpact: 'high',
          recommendedTeam: 'transport-coordination',
          recommendedActions: [
            'Hold outflow at Gates D and E in waves',
            'Direct fans to the shuttle stop at Gate C',
          ],
          requiresHumanApproval: true,
          confidence: 0.9,
        }),
        rawReport: 'Metro station entrance is completely jammed, people pushing.',
      });
      break;
    }

    case 'waste_overflow_fc2': {
      title = 'Waste overflow at Food Court 2';
      description = 'Bins at Food Court 2 are overflowing; cleanup crew needed.';
      sustainability.wasteFill = { 'food-court-1': 0.45, 'food-court-2': 0.97 };
      sustainability.alerts = ['Food Court 2 waste at 97% — collection overdue'];
      facilityOverrides['food-court-2'] = { status: 'busy', queueLoad: 0.7 };
      seededIncidents.push({
        extraction: inc({
          category: 'waste_overflow',
          severity: 'medium',
          summary: 'Waste bins overflowing at Food Court 2',
          locationId: 'food-court-2',
          peopleAffectedEstimate: 60,
          operationalImpact: 'medium',
          recommendedTeam: 'sustainability',
          recommendedActions: [
            'Dispatch cleanup crew to Food Court 2',
            'Open auxiliary bins on the south concourse',
          ],
          confidence: 0.93,
        }),
        rawReport: 'Trash is spilling out of every bin at food court 2, floor getting slippery.',
      });
      break;
    }

    case 'heat_advisory': {
      title = 'Heat advisory';
      description = 'High temperature alert; hydration and shaded routing prioritized.';
      sustainability.alerts = ['Heat advisory in effect — hydration stations on high output'];
      sustainability.waterUseLiters = 98000;
      facilityOverrides['water-b'] = { status: 'busy', queueLoad: 0.8 };
      facilityOverrides['water-e'] = { status: 'busy', queueLoad: 0.75 };
      crowd['gate-f-concourse'] = 0.5;
      seededIncidents.push({
        extraction: inc({
          category: 'weather',
          severity: 'high',
          summary: 'Heat advisory: elevated heat-stress risk on sun-exposed concourses',
          locationId: 'concourse-f',
          peopleAffectedEstimate: 500,
          accessibilityImpact: 'medium',
          operationalImpact: 'medium',
          recommendedTeam: 'guest-services',
          recommendedActions: [
            'Announce free water refills at all stations',
            'Open the quiet room as an additional cooling space',
          ],
          confidence: 0.9,
        }),
        rawReport: 'Multiple fans reporting dizziness on the south concourse, very hot in the sun.',
      });
      break;
    }

    case 'multilingual_spike': {
      title = 'Multilingual assistance spike';
      description = 'Large visiting-fan arrival needs ES/FR/HI guidance at Gate E.';
      crowd['gate-e-concourse'] = 0.6;
      seededIncidents.push({
        extraction: inc({
          category: 'other',
          severity: 'low',
          summary: 'Surge of visiting fans needing non-English wayfinding at Gate E',
          locationId: 'gate-e',
          peopleAffectedEstimate: 200,
          operationalImpact: 'low',
          recommendedTeam: 'guest-services',
          recommendedActions: [
            'Publish multilingual welcome and wayfinding announcement',
            'Send bilingual volunteers to Gate E',
          ],
          confidence: 0.85,
        }),
        rawReport: 'Big group at gate E asking directions, mostly Spanish and French speakers.',
      });
      break;
    }
  }

  return {
    id,
    title,
    description,
    crowd,
    facilityOverrides,
    transport,
    sustainability,
    seededIncidents,
  };
}

export const SCENARIO_IDS: readonly ScenarioId[] = [
  'normal_match_day',
  'gate_b_surge',
  'elevator_outage',
  'missing_child',
  'medical_section_114',
  'metro_overload',
  'waste_overflow_fc2',
  'heat_advisory',
  'multilingual_spike',
] as const;

export function buildBaselineSnapshot(): BaselineSnapshot {
  return {
    simulation: { activeScenario: 'normal_match_day', clockMinutes: 0, sequence: 0 },
    crowd: baseCrowd(0.3),
    facilities: baseFacilities(),
    incidents: [],
    routes: [],
    transport: baseTransport(),
    sustainability: baseSustainability(),
    announcements: [],
  };
}

/** Apply a scenario through store actions (single source of truth). */
export function applyScenario(store: StadiumStore, id: ScenarioId): void {
  const def = buildScenario(id);
  store.beginScenario(id);
  store.setCrowd(def.crowd);

  const facilities = baseFacilities();
  for (const [nodeId, patch] of Object.entries(def.facilityOverrides)) {
    const existing = facilities[nodeId];
    if (existing) facilities[nodeId] = { ...existing, ...patch };
  }
  store.setFacilities(facilities);
  store.setTransport(def.transport);
  store.setSustainability(def.sustainability);

  for (const seed of def.seededIncidents) {
    store.reportIncident(seed.extraction, {
      rawReport: seed.rawReport,
      reportedBy: 'scenario',
      provenance: 'fixture',
    });
  }
}

/** Reset to the consistent baseline. */
export function resetScenario(store: StadiumStore): void {
  store.restoreBaseline(buildBaselineSnapshot());
}
