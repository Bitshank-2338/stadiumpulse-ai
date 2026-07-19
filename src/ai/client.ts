/**
 * StadiumPulse AI — frontend AI client.
 * Original StadiumPulse AI code.
 *
 * Calls the serverless Gemini endpoints. Never sees the API key. Every call
 * has a deterministic fallback; provenance is recorded in the store so the UI
 * can always show where an answer came from.
 */

import { z } from 'zod';
import { AI_CONFIG } from './config';
import {
  AccessibilityExplanationSchema,
  AnnouncementSchema,
  FanIntentSchema,
  IncidentExtractionSchema,
  RouteExplanationSchema,
  SituationBriefSchema,
  SustainabilityRecommendationSchema,
  TransportAdvisorySchema,
} from './schemas';
import type { AiTaskKind } from './schemas';
import { useStadiumStore } from '../store/stadium-store';
import type { AiProvenance } from '../types/domain';

const ENDPOINT_FOR: Record<AiTaskKind, string> = {
  incident: 'incident',
  'fan-intent': 'fan-guidance',
  'route-explanation': 'fan-guidance',
  'accessibility-explanation': 'fan-guidance',
  'situation-brief': 'situation-brief',
  announcement: 'announcement',
  'transport-advisory': 'announcement',
  'sustainability-recommendation': 'announcement',
};

export interface AiCallResult<T> {
  data: T;
  provenance: AiProvenance;
}

async function callTask<T>(
  task: AiTaskKind,
  schema: z.ZodType<T>,
  payload: { userText?: string; context?: unknown },
  fallback: () => T,
): Promise<AiCallResult<T>> {
  const setAiStatus = useStadiumStore.getState().setAiStatus;
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_CONFIG.timeoutMs + 2000);
    const res = await fetch(`/api/gemini/${ENDPOINT_FOR[task]}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task, ...payload }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const body: unknown = await res.json();
    const parsed = z
      .object({ ok: z.literal(true), data: z.unknown() })
      .safeParse(body);
    if (res.ok && parsed.success) {
      const validated = schema.safeParse(parsed.data.data);
      if (validated.success) {
        setAiStatus({
          available: true,
          lastProvenance: 'gemini',
          lastLatencyMs: Date.now() - started,
          lastError: null,
        });
        return { data: validated.data, provenance: 'gemini' };
      }
    }
    const errBody = z.object({ error: z.string() }).safeParse(body);
    throw new Error(errBody.success ? errBody.data.error : `AI endpoint returned ${res.status}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI unavailable';
    setAiStatus({
      available: false,
      lastProvenance: 'fallback',
      lastLatencyMs: Date.now() - started,
      lastError: message,
    });
    useStadiumStore
      .getState()
      .appendAudit('system', 'ai_fallback_used', `${task}: ${message}`);
    return { data: fallback(), provenance: 'fallback' };
  }
}

// ---------------------------------------------------------------------------
// Typed task wrappers
// ---------------------------------------------------------------------------

export const aiClient = {
  extractIncident: (
    userText: string,
    locationHint: string | undefined,
    fallback: () => z.infer<typeof IncidentExtractionSchema>,
  ) =>
    callTask(
      'incident',
      IncidentExtractionSchema,
      {
        userText,
        context: { locationHint: locationHint ?? null },
      },
      fallback,
    ),

  interpretFan: (
    userText: string,
    context: unknown,
    fallback: () => z.infer<typeof FanIntentSchema>,
  ) => callTask('fan-intent', FanIntentSchema, { userText, context }, fallback),

  explainRoute: (
    context: unknown,
    fallback: () => z.infer<typeof RouteExplanationSchema>,
  ) => callTask('route-explanation', RouteExplanationSchema, { context }, fallback),

  situationBrief: (
    context: unknown,
    fallback: () => z.infer<typeof SituationBriefSchema>,
  ) => callTask('situation-brief', SituationBriefSchema, { context }, fallback),

  announcement: (
    context: unknown,
    fallback: () => z.infer<typeof AnnouncementSchema>,
  ) => callTask('announcement', AnnouncementSchema, { context }, fallback),

  transportAdvisory: (
    context: unknown,
    fallback: () => z.infer<typeof TransportAdvisorySchema>,
  ) => callTask('transport-advisory', TransportAdvisorySchema, { context }, fallback),

  sustainabilityRecommendation: (
    context: unknown,
    fallback: () => z.infer<typeof SustainabilityRecommendationSchema>,
  ) =>
    callTask(
      'sustainability-recommendation',
      SustainabilityRecommendationSchema,
      { context },
      fallback,
    ),

  explainAccessibleRoute: (
    context: unknown,
    fallback: () => z.infer<typeof AccessibilityExplanationSchema>,
  ) =>
    callTask(
      'accessibility-explanation',
      AccessibilityExplanationSchema,
      { context },
      fallback,
    ),
};
