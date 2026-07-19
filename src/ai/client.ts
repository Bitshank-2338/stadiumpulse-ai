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
import { ENDPOINT_FOR } from './endpoints';
import { useStadiumStore } from '../store/stadium-store';
import type {
  AccessibilityPreferences,
  AiProvenance,
  HealthBreakdown,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  RoutingMode,
  SustainabilityState,
  TransportState,
} from '../types/domain';

export interface AiCallResult<T> {
  data: T;
  provenance: AiProvenance;
}

// ---------------------------------------------------------------------------
// Task context shapes — mirror the exact literals passed at call sites in
// src/features/fan/fan-companion.tsx and src/features/ops/command-center.tsx.
// ---------------------------------------------------------------------------

export interface FanIntentContext {
  origin: string;
  preferences: AccessibilityPreferences;
}

export interface RouteExplanationContext {
  from: string;
  to: string;
  mode: RoutingMode;
  distanceMeters: number;
  etaSeconds: number;
  stepFree: boolean;
  usesElevator: boolean;
  stops: string[];
  notes: string[];
  preferences: AccessibilityPreferences;
}

export interface AnnouncementContext {
  incident: {
    category: IncidentCategory;
    severity: IncidentSeverity;
    summary: string;
    location: string;
    // Indexing `incident.recommendedActions[i]` under noUncheckedIndexedAccess
    // yields `string | undefined`, so this stays loose to match the call site.
    approvedActions: (string | undefined)[];
  };
}

export interface SituationBriefContext {
  scenario: string;
  health: HealthBreakdown;
  openIncidents: {
    id: string;
    category: IncidentCategory;
    severity: IncidentSeverity;
    summary: string;
    location: string;
    status: IncidentStatus;
  }[];
  crowdHotspots: { zone: string; load: number }[];
  transport: TransportState;
  sustainability: { alerts: string[]; wasteFill: Record<string, number> };
}

export interface TransportAdvisoryContext {
  transport: TransportState;
}

export interface SustainabilityRecommendationContext {
  sustainability: SustainabilityState;
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
  ): Promise<AiCallResult<z.infer<typeof IncidentExtractionSchema>>> =>
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
    context: FanIntentContext,
    fallback: () => z.infer<typeof FanIntentSchema>,
  ): Promise<AiCallResult<z.infer<typeof FanIntentSchema>>> =>
    callTask('fan-intent', FanIntentSchema, { userText, context }, fallback),

  explainRoute: (
    context: RouteExplanationContext,
    fallback: () => z.infer<typeof RouteExplanationSchema>,
  ): Promise<AiCallResult<z.infer<typeof RouteExplanationSchema>>> =>
    callTask('route-explanation', RouteExplanationSchema, { context }, fallback),

  situationBrief: (
    context: SituationBriefContext,
    fallback: () => z.infer<typeof SituationBriefSchema>,
  ): Promise<AiCallResult<z.infer<typeof SituationBriefSchema>>> =>
    callTask('situation-brief', SituationBriefSchema, { context }, fallback),

  announcement: (
    context: AnnouncementContext,
    fallback: () => z.infer<typeof AnnouncementSchema>,
  ): Promise<AiCallResult<z.infer<typeof AnnouncementSchema>>> =>
    callTask('announcement', AnnouncementSchema, { context }, fallback),

  transportAdvisory: (
    context: TransportAdvisoryContext,
    fallback: () => z.infer<typeof TransportAdvisorySchema>,
  ): Promise<AiCallResult<z.infer<typeof TransportAdvisorySchema>>> =>
    callTask('transport-advisory', TransportAdvisorySchema, { context }, fallback),

  sustainabilityRecommendation: (
    context: SustainabilityRecommendationContext,
    fallback: () => z.infer<typeof SustainabilityRecommendationSchema>,
  ): Promise<AiCallResult<z.infer<typeof SustainabilityRecommendationSchema>>> =>
    callTask(
      'sustainability-recommendation',
      SustainabilityRecommendationSchema,
      { context },
      fallback,
    ),

  explainAccessibleRoute: (
    context: RouteExplanationContext,
    fallback: () => z.infer<typeof AccessibilityExplanationSchema>,
  ): Promise<AiCallResult<z.infer<typeof AccessibilityExplanationSchema>>> =>
    callTask(
      'accessibility-explanation',
      AccessibilityExplanationSchema,
      { context },
      fallback,
    ),
};
