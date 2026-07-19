/**
 * StadiumPulse AI — shared domain types.
 * Original StadiumPulse AI code. Owned by the orchestrator; agents must not
 * modify without approval.
 */

// ---------------------------------------------------------------------------
// Spatial model
// ---------------------------------------------------------------------------

export type NodeKind =
  | 'gate'
  | 'junction'
  | 'concourse'
  | 'seating_entrance'
  | 'facility'
  | 'elevator'
  | 'stair'
  | 'escalator'
  | 'transport_exit';

export type FacilityKind =
  | 'restroom'
  | 'accessible_restroom'
  | 'water_station'
  | 'food_court'
  | 'medical_room'
  | 'quiet_room'
  | 'assistance_desk'
  | 'accessible_platform'
  | 'operations_room'
  | 'metro_point'
  | 'shuttle_point';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StadiumNode {
  id: string;
  kind: NodeKind;
  /** Facility subtype when kind === 'facility' (or vertical-transport nodes). */
  facilityKind?: FacilityKind;
  label: string;
  /** World position in the 3D scene (metres). */
  position: Vec3;
  /** Concourse level: 0 = ground, 1 = club, 2 = upper. */
  level: 0 | 1 | 2;
  /** Zone identifier, e.g. 'north-concourse', 'gate-b-plaza'. */
  zoneId: string;
}

export interface StadiumEdge {
  id: string;
  from: string;
  to: string;
  /** Metres. */
  distance: number;
  /** Seconds at normal walking pace. */
  baseTimeSeconds: number;
  /** Metres, usable corridor width. */
  width: number;
  hasStairs: boolean;
  isEscalator: boolean;
  /** Node id of the elevator this edge depends on, if any. */
  elevatorId?: string;
  /** True when traversable by wheelchair (no steps, adequate width). */
  stepFree: boolean;
  /** 0 (silent) .. 1 (very loud). */
  noiseLevel: number;
  open: boolean;
}

export interface StadiumGraph {
  nodes: Record<string, StadiumNode>;
  edges: StadiumEdge[];
}

// ---------------------------------------------------------------------------
// Crowd
// ---------------------------------------------------------------------------

/** 0 (empty) .. 1 (dangerously dense) congestion per zone. */
export type CrowdMap = Record<string, number>;

// ---------------------------------------------------------------------------
// Facilities (dynamic status layered over static graph nodes)
// ---------------------------------------------------------------------------

export type FacilityStatus = 'open' | 'busy' | 'closed' | 'outage';

export interface FacilityState {
  nodeId: string;
  status: FacilityStatus;
  /** 0..1 queue load where meaningful (food, restrooms, transport). */
  queueLoad: number;
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export type IncidentCategory =
  | 'crowd_congestion'
  | 'medical'
  | 'security'
  | 'missing_person'
  | 'accessibility_outage'
  | 'facility_issue'
  | 'waste_overflow'
  | 'transport_disruption'
  | 'weather'
  | 'fire'
  | 'violence'
  | 'structural'
  | 'evacuation'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus =
  | 'reported'
  | 'acknowledged'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected';

export type ImpactLevel = 'none' | 'low' | 'medium' | 'high';

export type TeamId =
  | 'crowd-operations'
  | 'medical-response'
  | 'security'
  | 'accessibility-support'
  | 'facilities-maintenance'
  | 'sustainability'
  | 'transport-coordination'
  | 'guest-services';

/** Categories that always require explicit human approval to act/resolve. */
export const HIGH_RISK_CATEGORIES: readonly IncidentCategory[] = [
  'medical',
  'fire',
  'security',
  'missing_person',
  'violence',
  'structural',
  'evacuation',
] as const;

export type AiProvenance = 'gemini' | 'fallback' | 'fixture';

export interface IncidentExtraction {
  category: IncidentCategory;
  severity: IncidentSeverity;
  summary: string;
  locationId: string;
  peopleAffectedEstimate: number;
  accessibilityImpact: ImpactLevel;
  operationalImpact: ImpactLevel;
  recommendedTeam: TeamId;
  recommendedActions: string[];
  requiresHumanApproval: boolean;
  missingInformation: string[];
  confidence: number;
}

export interface Incident extends IncidentExtraction {
  id: string;
  status: IncidentStatus;
  reportedBy: 'volunteer' | 'fan' | 'system' | 'scenario';
  rawReport: string;
  createdAt: number;
  updatedAt: number;
  assignedTeam?: TeamId;
  notes: IncidentNote[];
  /** Where the structured extraction came from. */
  provenance: AiProvenance;
  /** Ids of operator-approved recommended actions (index-based keys). */
  approvedActions: number[];
  rejectedActions: number[];
}

export interface IncidentNote {
  at: number;
  author: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export type RoutingMode =
  | 'shortest'
  | 'least_crowded'
  | 'step_free'
  | 'avoid_stairs'
  | 'avoid_escalators'
  | 'reduced_sensory'
  | 'emergency_diversion';

export interface RouteRequest {
  fromNodeId: string;
  toNodeId: string;
  mode: RoutingMode;
  preferences: AccessibilityPreferences;
}

export interface RouteResult {
  ok: true;
  nodeIds: string[];
  /** Polyline through node positions for 3D rendering. */
  path: Vec3[];
  distanceMeters: number;
  etaSeconds: number;
  /** 0..1 worst congestion encountered. */
  maxCongestion: number;
  stepFree: boolean;
  usesElevator: boolean;
  notes: string[];
}

export interface RouteFailure {
  ok: false;
  /** Machine-readable reason. */
  reason:
    | 'same_origin_destination'
    | 'no_route'
    | 'no_accessible_route'
    | 'destination_closed'
    | 'unknown_node';
  /** Human-readable explanation — never a generic failure. */
  explanation: string;
  /** Nearest assistance desk to fall back to, when relevant. */
  fallbackNodeId?: string;
}

export type RouteOutcome = RouteResult | RouteFailure;

export interface ActiveRoute {
  id: string;
  ownerRole: 'fan' | 'accessibility' | 'volunteer' | 'operator';
  request: RouteRequest;
  outcome: RouteOutcome;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Accessibility preferences
// ---------------------------------------------------------------------------

export interface AccessibilityPreferences {
  wheelchair: boolean;
  stepFree: boolean;
  avoidStairs: boolean;
  avoidEscalators: boolean;
  reducedSensory: boolean;
  hearingLoopPriority: boolean;
  companionAssistance: boolean;
  extraWalkingTime: boolean;
  accessibleRestroomPriority: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

export const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  wheelchair: false,
  stepFree: false,
  avoidStairs: false,
  avoidEscalators: false,
  reducedSensory: false,
  hearingLoopPriority: false,
  companionAssistance: false,
  extraWalkingTime: false,
  accessibleRestroomPriority: false,
  reducedMotion: false,
  highContrast: false,
};

// ---------------------------------------------------------------------------
// Transport & sustainability
// ---------------------------------------------------------------------------

export interface TransportState {
  /** 0..1 load per transport node id (metro, shuttle, gates as exits). */
  load: Record<string, number>;
  metroStatus: 'normal' | 'delayed' | 'overloaded' | 'suspended';
  shuttleStatus: 'normal' | 'delayed' | 'boosted';
  advisories: string[];
}

export interface SustainabilityState {
  /** 0..1 fill per waste point id. */
  wasteFill: Record<string, number>;
  /** kWh figure, simulated. */
  energyUseKwh: number;
  waterUseLiters: number;
  alerts: string[];
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export type AnnouncementLanguage = 'en' | 'es' | 'fr' | 'hi';

export interface AnnouncementTranslation {
  language: AnnouncementLanguage;
  text: string;
}

export interface Announcement {
  id: string;
  incidentId?: string;
  title: string;
  translations: AnnouncementTranslation[];
  status: 'draft' | 'approved' | 'published';
  createdAt: number;
  publishedAt?: number;
  provenance: AiProvenance;
}

// ---------------------------------------------------------------------------
// Scenarios & simulation
// ---------------------------------------------------------------------------

export type ScenarioId =
  | 'normal_match_day'
  | 'gate_b_surge'
  | 'elevator_outage'
  | 'missing_child'
  | 'medical_section_114'
  | 'metro_overload'
  | 'waste_overflow_fc2'
  | 'heat_advisory'
  | 'multilingual_spike';

export interface SimulationState {
  activeScenario: ScenarioId;
  /** Simulated clock, minutes since gates opened. */
  clockMinutes: number;
  /** Monotonic counter used for deterministic ids. */
  sequence: number;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'incident_reported'
  | 'incident_acknowledged'
  | 'incident_assigned'
  | 'incident_action_approved'
  | 'incident_action_rejected'
  | 'incident_note_added'
  | 'incident_resolved'
  | 'incident_reopened'
  | 'announcement_generated'
  | 'announcement_approved'
  | 'announcement_published'
  | 'scenario_activated'
  | 'scenario_reset'
  | 'route_requested'
  | 'ai_fallback_used';

export interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  action: AuditAction;
  detail: string;
  refId?: string;
}

// ---------------------------------------------------------------------------
// AI status (transparency)
// ---------------------------------------------------------------------------

export interface AiStatus {
  available: boolean;
  lastProvenance: AiProvenance | null;
  lastLatencyMs: number | null;
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Health score
// ---------------------------------------------------------------------------

export interface HealthBreakdown {
  /** 0..100 overall. */
  overall: number;
  crowd: number;
  incidents: number;
  accessibility: number;
  transport: number;
  sustainability: number;
}
