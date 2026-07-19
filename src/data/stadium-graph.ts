/**
 * StadiumPulse AI — stadium movement graph.
 * Original StadiumPulse AI code (data authored for this project).
 *
 * World coordinates match the 3D scene: y-up, pitch at origin, tier radii
 * rx 63–94 / rz 46–77, outer concourse ring ~rx 104 / rz 86, gates ~rx 118 / rz 98.
 * Levels: 0 = ground concourse (y≈0), 2 = upper concourse (y≈27).
 */

import type {
  FacilityKind,
  NodeKind,
  StadiumEdge,
  StadiumGraph,
  StadiumNode,
  Vec3,
} from '../types/domain';

const DEG = Math.PI / 180;

function onEllipse(angleDeg: number, rx: number, rz: number, y: number): Vec3 {
  return {
    x: Math.cos(angleDeg * DEG) * rx,
    y,
    z: Math.sin(angleDeg * DEG) * rz,
  };
}

const UPPER_Y = 27.6;

interface NodeSpec {
  id: string;
  kind: NodeKind;
  facilityKind?: FacilityKind;
  label: string;
  angleDeg: number;
  rx: number;
  rz: number;
  y: number;
  level: 0 | 1 | 2;
  zoneId: string;
}

// Gate angles — six gates evenly around the bowl.
// A=90 (north), B=30, C=-30 (south-east), D=210 (south-west), E=150, F=-90 (south).
const GATE_ANGLES: Record<string, number> = {
  a: 90,
  b: 30,
  c: -30,
  d: 210,
  e: 150,
  f: -90,
};

const NODE_SPECS: NodeSpec[] = [
  // --- Gates (outer perimeter, ground level) -------------------------------
  ...Object.entries(GATE_ANGLES).map(([g, angle]): NodeSpec => ({
    id: `gate-${g}`,
    kind: 'gate',
    label: `Gate ${g.toUpperCase()}`,
    angleDeg: angle,
    rx: 118,
    rz: 98,
    y: 0,
    level: 0,
    zoneId: `gate-${g}-plaza`,
  })),

  // --- Ground concourse ring (one junction per gate sector) ----------------
  ...Object.entries(GATE_ANGLES).map(([g, angle]): NodeSpec => ({
    id: `concourse-${g}`,
    kind: 'concourse',
    label: `${g.toUpperCase()} Concourse`,
    angleDeg: angle,
    rx: 104,
    rz: 86,
    y: 0,
    level: 0,
    zoneId: `gate-${g}-concourse`,
  })),

  // --- Upper concourse ring (four sectors) ---------------------------------
  { id: 'upper-north', kind: 'concourse', label: 'Upper North Concourse', angleDeg: 90, rx: 96, rz: 79, y: UPPER_Y, level: 2, zoneId: 'upper-north' },
  { id: 'upper-east', kind: 'concourse', label: 'Upper East Concourse', angleDeg: 0, rx: 96, rz: 79, y: UPPER_Y, level: 2, zoneId: 'upper-east' },
  { id: 'upper-south', kind: 'concourse', label: 'Upper South Concourse', angleDeg: -90, rx: 96, rz: 79, y: UPPER_Y, level: 2, zoneId: 'upper-south' },
  { id: 'upper-west', kind: 'concourse', label: 'Upper West Concourse', angleDeg: 180, rx: 96, rz: 79, y: UPPER_Y, level: 2, zoneId: 'upper-west' },

  // --- Seating entrances ---------------------------------------------------
  { id: 'section-114', kind: 'seating_entrance', label: 'Section 114', angleDeg: 55, rx: 90, rz: 74, y: 1.4, level: 0, zoneId: 'gate-a-concourse' },
  { id: 'section-127', kind: 'seating_entrance', label: 'Section 127', angleDeg: -60, rx: 90, rz: 74, y: 1.4, level: 0, zoneId: 'gate-f-concourse' },
  { id: 'section-315', kind: 'seating_entrance', label: 'Section 315', angleDeg: 45, rx: 94, rz: 77, y: UPPER_Y, level: 2, zoneId: 'upper-north' },
  { id: 'section-332', kind: 'seating_entrance', label: 'Section 332', angleDeg: -135, rx: 94, rz: 77, y: UPPER_Y, level: 2, zoneId: 'upper-west' },

  // --- Vertical transport --------------------------------------------------
  { id: 'elevator-north', kind: 'elevator', facilityKind: 'accessible_platform', label: 'North Elevator', angleDeg: 75, rx: 100, rz: 82, y: 0, level: 0, zoneId: 'gate-a-concourse' },
  { id: 'elevator-south', kind: 'elevator', facilityKind: 'accessible_platform', label: 'South Elevator', angleDeg: -105, rx: 100, rz: 82, y: 0, level: 0, zoneId: 'gate-f-concourse' },
  { id: 'stairs-east', kind: 'stair', label: 'East Stairs', angleDeg: 10, rx: 100, rz: 82, y: 0, level: 0, zoneId: 'gate-b-concourse' },
  { id: 'stairs-west', kind: 'stair', label: 'West Stairs', angleDeg: 190, rx: 100, rz: 82, y: 0, level: 0, zoneId: 'gate-d-concourse' },
  { id: 'escalator-north', kind: 'escalator', label: 'North Escalator', angleDeg: 120, rx: 100, rz: 82, y: 0, level: 0, zoneId: 'gate-e-concourse' },
  { id: 'escalator-south', kind: 'escalator', label: 'South Escalator', angleDeg: -55, rx: 100, rz: 82, y: 0, level: 0, zoneId: 'gate-f-concourse' },

  // --- Ground facilities ---------------------------------------------------
  { id: 'restroom-a', kind: 'facility', facilityKind: 'restroom', label: 'Restroom (Gate A)', angleDeg: 100, rx: 106, rz: 88, y: 0, level: 0, zoneId: 'gate-a-concourse' },
  { id: 'restroom-c', kind: 'facility', facilityKind: 'restroom', label: 'Restroom (Gate C)', angleDeg: -40, rx: 106, rz: 88, y: 0, level: 0, zoneId: 'gate-c-concourse' },
  { id: 'accessible-restroom-a', kind: 'facility', facilityKind: 'accessible_restroom', label: 'Accessible Restroom (Gate A)', angleDeg: 82, rx: 106, rz: 88, y: 0, level: 0, zoneId: 'gate-a-concourse' },
  { id: 'accessible-restroom-d', kind: 'facility', facilityKind: 'accessible_restroom', label: 'Accessible Restroom (Gate D)', angleDeg: 218, rx: 106, rz: 88, y: 0, level: 0, zoneId: 'gate-d-concourse' },
  { id: 'water-b', kind: 'facility', facilityKind: 'water_station', label: 'Water Station (Gate B)', angleDeg: 38, rx: 106, rz: 88, y: 0, level: 0, zoneId: 'gate-b-concourse' },
  { id: 'water-e', kind: 'facility', facilityKind: 'water_station', label: 'Water Station (Gate E)', angleDeg: 142, rx: 106, rz: 88, y: 0, level: 0, zoneId: 'gate-e-concourse' },
  { id: 'food-court-1', kind: 'facility', facilityKind: 'food_court', label: 'Food Court 1 (North)', angleDeg: 110, rx: 108, rz: 90, y: 0, level: 0, zoneId: 'gate-e-concourse' },
  { id: 'food-court-2', kind: 'facility', facilityKind: 'food_court', label: 'Food Court 2 (South)', angleDeg: -70, rx: 108, rz: 90, y: 0, level: 0, zoneId: 'gate-f-concourse' },
  { id: 'medical-room', kind: 'facility', facilityKind: 'medical_room', label: 'Medical Room', angleDeg: 20, rx: 106, rz: 88, y: 0, level: 0, zoneId: 'gate-b-concourse' },
  { id: 'quiet-room', kind: 'facility', facilityKind: 'quiet_room', label: 'Quiet Room', angleDeg: 200, rx: 106, rz: 88, y: 0, level: 0, zoneId: 'gate-d-concourse' },
  { id: 'assistance-desk-a', kind: 'facility', facilityKind: 'assistance_desk', label: 'Assistance Desk (Gate A)', angleDeg: 95, rx: 108, rz: 90, y: 0, level: 0, zoneId: 'gate-a-concourse' },
  { id: 'assistance-desk-d', kind: 'facility', facilityKind: 'assistance_desk', label: 'Assistance Desk (Gate D)', angleDeg: 205, rx: 108, rz: 90, y: 0, level: 0, zoneId: 'gate-d-concourse' },
  { id: 'operations-room', kind: 'facility', facilityKind: 'operations_room', label: 'Operations Room', angleDeg: 0, rx: 108, rz: 90, y: 0, level: 0, zoneId: 'gate-b-concourse' },

  // --- Transport exits -----------------------------------------------------
  { id: 'metro-point', kind: 'transport_exit', facilityKind: 'metro_point', label: 'Metro Station', angleDeg: 150, rx: 132, rz: 110, y: 0, level: 0, zoneId: 'transport-west' },
  { id: 'shuttle-point', kind: 'transport_exit', facilityKind: 'shuttle_point', label: 'Shuttle Stop', angleDeg: -30, rx: 132, rz: 110, y: 0, level: 0, zoneId: 'transport-east' },
];

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

const WALK_SPEED_MPS = 1.25;

interface EdgeSpec {
  from: string;
  to: string;
  hasStairs?: boolean;
  isEscalator?: boolean;
  elevatorId?: string;
  /** Defaults to !hasStairs && !isEscalator. */
  stepFree?: boolean;
  noiseLevel?: number;
  width?: number;
  /** Extra seconds beyond walking time (e.g. elevator wait). */
  extraSeconds?: number;
}

const GATE_ORDER = ['a', 'b', 'c', 'f', 'd', 'e'] as const; // clockwise around ellipse

const EDGE_SPECS: EdgeSpec[] = [
  // Gates ↔ their concourse
  ...GATE_ORDER.map((g) => ({ from: `gate-${g}`, to: `concourse-${g}`, noiseLevel: 0.5 })),

  // Ground concourse ring (adjacent sectors)
  ...GATE_ORDER.map((g, i) => ({
    from: `concourse-${g}`,
    to: `concourse-${GATE_ORDER[(i + 1) % GATE_ORDER.length] ?? 'a'}`,
    noiseLevel: 0.55,
  })),

  // Upper concourse ring
  { from: 'upper-north', to: 'upper-east', noiseLevel: 0.4 },
  { from: 'upper-east', to: 'upper-south', noiseLevel: 0.4 },
  { from: 'upper-south', to: 'upper-west', noiseLevel: 0.4 },
  { from: 'upper-west', to: 'upper-north', noiseLevel: 0.4 },

  // Vertical transport: ground node pairs + link to upper ring
  { from: 'concourse-a', to: 'elevator-north', noiseLevel: 0.3 },
  { from: 'elevator-north', to: 'upper-north', elevatorId: 'elevator-north', stepFree: true, extraSeconds: 45, noiseLevel: 0.2 },
  { from: 'concourse-f', to: 'elevator-south', noiseLevel: 0.3 },
  { from: 'elevator-south', to: 'upper-south', elevatorId: 'elevator-south', stepFree: true, extraSeconds: 45, noiseLevel: 0.2 },
  { from: 'concourse-b', to: 'stairs-east', noiseLevel: 0.5 },
  { from: 'stairs-east', to: 'upper-east', hasStairs: true, noiseLevel: 0.5 },
  { from: 'concourse-d', to: 'stairs-west', noiseLevel: 0.5 },
  { from: 'stairs-west', to: 'upper-west', hasStairs: true, noiseLevel: 0.5 },
  { from: 'concourse-e', to: 'escalator-north', noiseLevel: 0.6 },
  { from: 'escalator-north', to: 'upper-north', isEscalator: true, noiseLevel: 0.6 },
  { from: 'concourse-f', to: 'escalator-south', noiseLevel: 0.6 },
  { from: 'escalator-south', to: 'upper-south', isEscalator: true, noiseLevel: 0.6 },

  // Seating entrances
  { from: 'concourse-a', to: 'section-114', noiseLevel: 0.7 },
  { from: 'concourse-b', to: 'section-114', noiseLevel: 0.7 },
  { from: 'concourse-f', to: 'section-127', noiseLevel: 0.7 },
  { from: 'upper-north', to: 'section-315', noiseLevel: 0.6 },
  { from: 'upper-west', to: 'section-332', noiseLevel: 0.6 },

  // Ground facilities (attach to nearest concourse sector)
  { from: 'concourse-a', to: 'restroom-a', noiseLevel: 0.4 },
  { from: 'concourse-c', to: 'restroom-c', noiseLevel: 0.4 },
  { from: 'concourse-a', to: 'accessible-restroom-a', noiseLevel: 0.3 },
  { from: 'concourse-d', to: 'accessible-restroom-d', noiseLevel: 0.3 },
  { from: 'concourse-b', to: 'water-b', noiseLevel: 0.4 },
  { from: 'concourse-e', to: 'water-e', noiseLevel: 0.4 },
  { from: 'concourse-e', to: 'food-court-1', noiseLevel: 0.8 },
  { from: 'concourse-f', to: 'food-court-2', noiseLevel: 0.8 },
  { from: 'concourse-b', to: 'medical-room', noiseLevel: 0.3 },
  { from: 'concourse-d', to: 'quiet-room', noiseLevel: 0.1 },
  { from: 'concourse-a', to: 'assistance-desk-a', noiseLevel: 0.3 },
  { from: 'concourse-d', to: 'assistance-desk-d', noiseLevel: 0.3 },
  { from: 'concourse-b', to: 'operations-room', noiseLevel: 0.3 },

  // Transport exits
  { from: 'gate-e', to: 'metro-point', noiseLevel: 0.7 },
  { from: 'gate-d', to: 'metro-point', noiseLevel: 0.7 },
  { from: 'gate-c', to: 'shuttle-point', noiseLevel: 0.6 },
  { from: 'gate-b', to: 'shuttle-point', noiseLevel: 0.6 },
];

export function buildStadiumGraph(): StadiumGraph {
  const nodes: Record<string, StadiumNode> = {};
  for (const spec of NODE_SPECS) {
    nodes[spec.id] = {
      id: spec.id,
      kind: spec.kind,
      ...(spec.facilityKind !== undefined ? { facilityKind: spec.facilityKind } : {}),
      label: spec.label,
      position: onEllipse(spec.angleDeg, spec.rx, spec.rz, spec.y),
      level: spec.level,
      zoneId: spec.zoneId,
    };
  }

  const edges: StadiumEdge[] = EDGE_SPECS.map((e, i) => {
    const a = nodes[e.from];
    const b = nodes[e.to];
    if (!a || !b) {
      throw new Error(`Edge ${e.from} → ${e.to} references unknown node`);
    }
    const d = Math.max(4, Math.round(dist(a.position, b.position)));
    const hasStairs = e.hasStairs ?? false;
    const isEscalator = e.isEscalator ?? false;
    return {
      id: `edge-${i}-${e.from}--${e.to}`,
      from: e.from,
      to: e.to,
      distance: d,
      baseTimeSeconds: Math.round(d / WALK_SPEED_MPS + (e.extraSeconds ?? 0)),
      width: e.width ?? 4,
      hasStairs,
      isEscalator,
      ...(e.elevatorId !== undefined ? { elevatorId: e.elevatorId } : {}),
      stepFree: e.stepFree ?? (!hasStairs && !isEscalator),
      noiseLevel: e.noiseLevel ?? 0.5,
      open: true,
    };
  });

  return { nodes, edges };
}

/** Singleton graph — static topology; dynamic status lives in the store. */
export const STADIUM_GRAPH: StadiumGraph = buildStadiumGraph();

export const ALL_ZONE_IDS: string[] = [
  ...new Set(Object.values(STADIUM_GRAPH.nodes).map((n) => n.zoneId)),
];
