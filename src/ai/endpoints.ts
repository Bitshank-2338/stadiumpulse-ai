/**
 * StadiumPulse AI — endpoint/task routing table (shared client/server).
 * Original StadiumPulse AI code.
 *
 * Single source of truth for which AI tasks each `/api/gemini/*` endpoint
 * accepts. Consumed by the Vercel handlers, the Vite dev bridge, the Cloud
 * Run server, and the frontend AI client (via the derived inverse map).
 */

import type { AiTaskKind } from './schemas';

export const ENDPOINT_TASKS = {
  incident: ['incident'],
  'fan-guidance': ['fan-intent', 'route-explanation', 'accessibility-explanation'],
  'situation-brief': ['situation-brief'],
  announcement: ['announcement', 'transport-advisory', 'sustainability-recommendation'],
} as const satisfies Record<string, readonly AiTaskKind[]>;

export type AiEndpoint = keyof typeof ENDPOINT_TASKS;

export interface AiErrorBody {
  ok: false;
  error: string;
}

export function aiError(error: string): AiErrorBody {
  return { ok: false, error };
}

export function tasksForEndpoint(endpoint: string): readonly AiTaskKind[] | undefined {
  return (ENDPOINT_TASKS as Record<string, readonly AiTaskKind[]>)[endpoint];
}

function buildEndpointFor(
  table: Record<string, readonly AiTaskKind[]>,
): Record<AiTaskKind, string> {
  const result = {} as Record<AiTaskKind, string>;
  for (const [endpoint, tasks] of Object.entries(table)) {
    for (const task of tasks) {
      result[task] = endpoint;
    }
  }
  return result;
}

/** Inverted lookup: task → owning endpoint. */
export const ENDPOINT_FOR: Record<AiTaskKind, string> = buildEndpointFor(ENDPOINT_TASKS);
