/**
 * StadiumPulse AI — derived-state selectors bridging the store and 3D scene.
 * Original StadiumPulse AI code.
 */

import type { SceneMarker, ZoneHeat } from '../scene/stadium-scene';
import { STADIUM_GRAPH } from '../data/stadium-graph';
import type {
  CrowdMap,
  FacilityState,
  Incident,
  IncidentSeverity,
  Vec3,
} from '../types/domain';

const SEVERITY_COLOR: Record<IncidentSeverity, number> = {
  low: 0xfbbf24,
  medium: 0xfbbf24,
  high: 0xf87171,
  critical: 0xf87171,
};

/** Representative world position per zone (centroid of its nodes). */
const ZONE_POSITIONS: Record<string, Vec3> = (() => {
  const acc = new Map<string, { x: number; y: number; z: number; n: number }>();
  for (const node of Object.values(STADIUM_GRAPH.nodes)) {
    const cur = acc.get(node.zoneId) ?? { x: 0, y: 0, z: 0, n: 0 };
    cur.x += node.position.x;
    cur.y += node.position.y;
    cur.z += node.position.z;
    cur.n += 1;
    acc.set(node.zoneId, cur);
  }
  const out: Record<string, Vec3> = {};
  for (const [zone, c] of acc) {
    out[zone] = { x: c.x / c.n, y: c.y / c.n, z: c.z / c.n };
  }
  return out;
})();

export function incidentMarkers(incidents: Incident[]): SceneMarker[] {
  const out: SceneMarker[] = [];
  for (const i of incidents) {
    if (i.status === 'resolved' || i.status === 'rejected') continue;
    const node = STADIUM_GRAPH.nodes[i.locationId];
    if (!node) continue;
    out.push({
      id: i.id,
      position: node.position,
      color: SEVERITY_COLOR[i.severity],
      pulse: i.severity === 'high' || i.severity === 'critical',
      label: i.summary,
    });
  }
  return out;
}

export function outageMarkers(facilities: Record<string, FacilityState>): SceneMarker[] {
  const out: SceneMarker[] = [];
  for (const f of Object.values(facilities)) {
    if (f.status !== 'outage') continue;
    const node = STADIUM_GRAPH.nodes[f.nodeId];
    if (!node) continue;
    out.push({
      id: `outage-${f.nodeId}`,
      position: node.position,
      color: 0xc4b5fd,
      pulse: true,
      label: `${node.label} out of service`,
    });
  }
  return out;
}

export function facilityMarkers(): SceneMarker[] {
  return Object.values(STADIUM_GRAPH.nodes)
    .filter((n) => n.kind === 'facility' || n.kind === 'transport_exit')
    .map((n) => ({
      id: `facility-${n.id}`,
      position: n.position,
      color: 0x22d3ee,
      label: n.label,
    }));
}

export function crowdHeat(crowd: CrowdMap): ZoneHeat[] {
  const out: ZoneHeat[] = [];
  for (const [zoneId, intensity] of Object.entries(crowd)) {
    const position = ZONE_POSITIONS[zoneId];
    if (!position) continue;
    out.push({ position, intensity, radius: 12 });
  }
  return out;
}

export function nodeLabel(nodeId: string): string {
  return STADIUM_GRAPH.nodes[nodeId]?.label ?? nodeId;
}

export function nodePosition(nodeId: string): Vec3 | undefined {
  return STADIUM_GRAPH.nodes[nodeId]?.position;
}
