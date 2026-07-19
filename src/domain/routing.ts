/**
 * StadiumPulse AI — deterministic routing engine.
 * Original StadiumPulse AI code. Dijkstra over the typed stadium graph.
 * Gemini never invents routes; it only explains the output of this module.
 */

import type {
  AccessibilityPreferences,
  CrowdMap,
  FacilityState,
  RouteFailure,
  RouteOutcome,
  RouteRequest,
  RouteResult,
  RoutingMode,
  StadiumEdge,
  StadiumGraph,
  StadiumNode,
} from '../types/domain';

export interface RoutingContext {
  graph: StadiumGraph;
  crowd: CrowdMap;
  facilities: Record<string, FacilityState>;
}

interface EdgeFilterResult {
  usable: boolean;
  /** Cost multiplier ≥ 1 applied to base time. */
  costFactor: number;
}

function congestionOf(ctx: RoutingContext, node: StadiumNode): number {
  return ctx.crowd[node.zoneId] ?? 0;
}

function elevatorOut(ctx: RoutingContext, edge: StadiumEdge): boolean {
  if (edge.elevatorId === undefined) return false;
  const status = ctx.facilities[edge.elevatorId]?.status;
  return status === 'outage' || status === 'closed';
}

function evaluateEdge(
  ctx: RoutingContext,
  edge: StadiumEdge,
  toNode: StadiumNode,
  mode: RoutingMode,
  prefs: AccessibilityPreferences,
): EdgeFilterResult {
  if (!edge.open) return { usable: false, costFactor: 1 };
  if (elevatorOut(ctx, edge)) return { usable: false, costFactor: 1 };

  const congestion = congestionOf(ctx, toNode);

  const needStepFree = mode === 'step_free' || prefs.wheelchair || prefs.stepFree;
  const avoidStairs = mode === 'avoid_stairs' || prefs.avoidStairs || needStepFree;
  const avoidEscalators =
    mode === 'avoid_escalators' || prefs.avoidEscalators || needStepFree;

  if (needStepFree && !edge.stepFree) return { usable: false, costFactor: 1 };
  if (avoidStairs && edge.hasStairs) return { usable: false, costFactor: 1 };
  if (avoidEscalators && edge.isEscalator) return { usable: false, costFactor: 1 };

  let factor = 1;
  switch (mode) {
    case 'least_crowded':
      factor += congestion * 4;
      break;
    case 'reduced_sensory':
      factor += edge.noiseLevel * 3 + congestion * 2;
      break;
    case 'emergency_diversion':
      factor += congestion * 6;
      break;
    default:
      factor += congestion * 1.5; // congestion always matters a little
  }
  if (prefs.reducedSensory && mode !== 'reduced_sensory') {
    factor += edge.noiseLevel * 2;
  }
  // Very congested edges are near-impassable in emergencies.
  if (mode === 'emergency_diversion' && congestion > 0.9) {
    return { usable: false, costFactor: 1 };
  }
  return { usable: true, costFactor: factor };
}

interface Adjacency {
  edge: StadiumEdge;
  neighborId: string;
}

function buildAdjacency(graph: StadiumGraph): Map<string, Adjacency[]> {
  const adj = new Map<string, Adjacency[]>();
  const push = (id: string, entry: Adjacency): void => {
    const list = adj.get(id);
    if (list) list.push(entry);
    else adj.set(id, [entry]);
  };
  for (const edge of graph.edges) {
    push(edge.from, { edge, neighborId: edge.to });
    push(edge.to, { edge, neighborId: edge.from });
  }
  return adj;
}

function dijkstra(
  ctx: RoutingContext,
  fromId: string,
  toId: string,
  mode: RoutingMode,
  prefs: AccessibilityPreferences,
): string[] | null {
  const adjacency = buildAdjacency(ctx.graph);
  const distMap = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  // Simple priority selection — graph is small (<50 nodes), O(n²) is fine.
  const frontier = new Set<string>([fromId]);

  while (frontier.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of frontier) {
      const d = distMap.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null) break;
    frontier.delete(current);
    if (current === toId) break;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const { edge, neighborId } of adjacency.get(current) ?? []) {
      if (visited.has(neighborId)) continue;
      const toNode = ctx.graph.nodes[neighborId];
      if (!toNode) continue;
      const evalResult = evaluateEdge(ctx, edge, toNode, mode, prefs);
      if (!evalResult.usable) continue;
      const cost = edge.baseTimeSeconds * evalResult.costFactor;
      const next = (distMap.get(current) ?? Infinity) + cost;
      if (next < (distMap.get(neighborId) ?? Infinity)) {
        distMap.set(neighborId, next);
        prev.set(neighborId, current);
        frontier.add(neighborId);
      }
    }
  }

  if (!distMap.has(toId) || (fromId !== toId && !prev.has(toId))) return null;
  const path: string[] = [toId];
  let cursor = toId;
  while (cursor !== fromId) {
    const p = prev.get(cursor);
    if (p === undefined) return null;
    path.unshift(p);
    cursor = p;
  }
  return path;
}

function edgeBetween(
  graph: StadiumGraph,
  a: string,
  b: string,
): StadiumEdge | undefined {
  return graph.edges.find(
    (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a),
  );
}

function nearestAssistanceDesk(ctx: RoutingContext, fromId: string): string | undefined {
  const desks = Object.values(ctx.graph.nodes).filter(
    (n) => n.facilityKind === 'assistance_desk',
  );
  const from = ctx.graph.nodes[fromId];
  if (!from || desks.length === 0) return undefined;
  let best: StadiumNode | undefined;
  let bestD = Infinity;
  for (const d of desks) {
    const dd = Math.hypot(
      d.position.x - from.position.x,
      d.position.z - from.position.z,
    );
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best?.id;
}

function buildResult(
  ctx: RoutingContext,
  nodeIds: string[],
  prefs: AccessibilityPreferences,
): RouteResult {
  let distance = 0;
  let eta = 0;
  let maxCongestion = 0;
  let stepFree = true;
  let usesElevator = false;
  const notes: string[] = [];

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const a = nodeIds[i];
    const b = nodeIds[i + 1];
    if (a === undefined || b === undefined) continue;
    const edge = edgeBetween(ctx.graph, a, b);
    const toNode = ctx.graph.nodes[b];
    if (!edge || !toNode) continue;
    distance += edge.distance;
    eta += edge.baseTimeSeconds;
    maxCongestion = Math.max(maxCongestion, congestionOf(ctx, toNode));
    if (!edge.stepFree) stepFree = false;
    if (edge.elevatorId !== undefined) usesElevator = true;
    if (edge.hasStairs) notes.push(`Stairs between ${a} and ${b}`);
  }

  if (prefs.extraWalkingTime) {
    eta = Math.round(eta * 1.4);
    notes.push('Extra walking time applied to the estimate.');
  }
  if (usesElevator) notes.push('Route uses an elevator (wait time included).');
  if (maxCongestion > 0.7) notes.push('Parts of this route are very busy right now.');

  const path = nodeIds
    .map((id) => ctx.graph.nodes[id]?.position)
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  return {
    ok: true,
    nodeIds,
    path,
    distanceMeters: distance,
    etaSeconds: eta,
    maxCongestion,
    stepFree,
    usesElevator,
    notes,
  };
}

export function computeRoute(ctx: RoutingContext, req: RouteRequest): RouteOutcome {
  const { fromNodeId, toNodeId, mode, preferences } = req;
  const from = ctx.graph.nodes[fromNodeId];
  const to = ctx.graph.nodes[toNodeId];

  if (!from || !to) {
    const failure: RouteFailure = {
      ok: false,
      reason: 'unknown_node',
      explanation: `We could not find ${!from ? fromNodeId : toNodeId} on the stadium map. Please pick a location from the list.`,
    };
    return failure;
  }

  if (fromNodeId === toNodeId) {
    return {
      ok: false,
      reason: 'same_origin_destination',
      explanation: `You are already at ${to.label}. No route is needed.`,
    };
  }

  const destStatus = ctx.facilities[toNodeId]?.status;
  if (destStatus === 'closed' || destStatus === 'outage') {
    const fallback = nearestAssistanceDesk(ctx, fromNodeId);
    return {
      ok: false,
      reason: 'destination_closed',
      explanation: `${to.label} is currently ${destStatus === 'outage' ? 'out of service' : 'closed'}. Staff at the nearest assistance desk can help you find an alternative.`,
      ...(fallback !== undefined ? { fallbackNodeId: fallback } : {}),
    };
  }

  const nodeIds = dijkstra(ctx, fromNodeId, toNodeId, mode, preferences);
  if (nodeIds) return buildResult(ctx, nodeIds, preferences);

  // Explain WHY: if an unconstrained route exists, the constraints removed it.
  const unconstrained = dijkstra(ctx, fromNodeId, toNodeId, 'shortest', {
    ...preferences,
    wheelchair: false,
    stepFree: false,
    avoidStairs: false,
    avoidEscalators: false,
  });
  const fallback = nearestAssistanceDesk(ctx, fromNodeId);
  if (unconstrained) {
    return {
      ok: false,
      reason: 'no_accessible_route',
      explanation: `A route to ${to.label} exists but no step-free path is available right now (an elevator may be out of service). Please visit the nearest assistance desk — staff can escort you via a service corridor.`,
      ...(fallback !== undefined ? { fallbackNodeId: fallback } : {}),
    };
  }
  return {
    ok: false,
    reason: 'no_route',
    explanation: `No open route to ${to.label} is available right now. This area may be temporarily closed. The nearest assistance desk can advise you.`,
    ...(fallback !== undefined ? { fallbackNodeId: fallback } : {}),
  };
}

/**
 * Rank facilities of a kind by constrained travel time from an origin.
 * Applies accessibility preferences (e.g. accessible-restroom priority).
 */
export function rankFacilities(
  ctx: RoutingContext,
  fromNodeId: string,
  kinds: readonly string[],
  mode: RoutingMode,
  prefs: AccessibilityPreferences,
): { nodeId: string; outcome: RouteOutcome }[] {
  const targets = Object.values(ctx.graph.nodes).filter(
    (n) => n.facilityKind !== undefined && kinds.includes(n.facilityKind),
  );
  const ranked = targets.map((t) => ({
    nodeId: t.id,
    outcome: computeRoute(ctx, {
      fromNodeId,
      toNodeId: t.id,
      mode,
      preferences: prefs,
    }),
  }));
  return ranked.sort((a, b) => {
    const ta = a.outcome.ok ? a.outcome.etaSeconds : Infinity;
    const tb = b.outcome.ok ? b.outcome.etaSeconds : Infinity;
    return ta - tb;
  });
}
