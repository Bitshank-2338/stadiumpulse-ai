/**
 * StadiumPulse AI — structured-output schemas (shared client/server).
 * Original StadiumPulse AI code.
 *
 * Every Gemini response is validated against these before entering the store.
 * Malformed output triggers one repair attempt, then deterministic fallback.
 */

import { z } from 'zod';

export const IncidentCategorySchema = z.enum([
  'crowd_congestion',
  'medical',
  'security',
  'missing_person',
  'accessibility_outage',
  'facility_issue',
  'waste_overflow',
  'transport_disruption',
  'weather',
  'fire',
  'violence',
  'structural',
  'evacuation',
  'other',
]);

export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ImpactSchema = z.enum(['none', 'low', 'medium', 'high']);
export const TeamSchema = z.enum([
  'crowd-operations',
  'medical-response',
  'security',
  'accessibility-support',
  'facilities-maintenance',
  'sustainability',
  'transport-coordination',
  'guest-services',
]);

export const IncidentExtractionSchema = z.object({
  category: IncidentCategorySchema,
  severity: SeveritySchema,
  summary: z.string().min(5).max(200),
  locationId: z.string().min(1),
  peopleAffectedEstimate: z.number().int().min(0).max(100000),
  accessibilityImpact: ImpactSchema,
  operationalImpact: ImpactSchema,
  recommendedTeam: TeamSchema,
  recommendedActions: z.array(z.string().min(3).max(200)).min(1).max(5),
  requiresHumanApproval: z.boolean(),
  missingInformation: z.array(z.string().max(200)).max(5),
  confidence: z.number().min(0).max(1),
});
export type IncidentExtractionOut = z.infer<typeof IncidentExtractionSchema>;

export const FanIntentSchema = z.object({
  kind: z.enum([
    'route_to_section',
    'route_to_node',
    'find_facility',
    'least_crowded_gate',
    'emergency_assistance',
    'unknown',
  ]),
  targetNodeId: z.string().optional(),
  facilityKinds: z.array(z.string()).max(3).optional(),
  mode: z.enum([
    'shortest',
    'least_crowded',
    'step_free',
    'avoid_stairs',
    'avoid_escalators',
    'reduced_sensory',
    'emergency_diversion',
  ]),
  understood: z.string().min(3).max(240),
});
export type FanIntentOut = z.infer<typeof FanIntentSchema>;

export const RouteExplanationSchema = z.object({
  explanation: z.string().min(10).max(600),
  accessibilityNotes: z.array(z.string().max(200)).max(4),
});
export type RouteExplanationOut = z.infer<typeof RouteExplanationSchema>;

export const SituationBriefSchema = z.object({
  headline: z.string().min(5).max(140),
  situation: z.string().min(10).max(900),
  observedFacts: z.array(z.string().max(240)).min(1).max(8),
  predictions: z.array(z.string().max(240)).max(5),
  recommendedPriorities: z.array(z.string().max(240)).min(1).max(5),
  requiresOperatorDecision: z.array(z.string().max(240)).max(5),
});
export type SituationBriefOut = z.infer<typeof SituationBriefSchema>;

export const AnnouncementSchema = z.object({
  title: z.string().min(3).max(120),
  translations: z
    .array(
      z.object({
        language: z.enum(['en', 'es', 'fr', 'hi']),
        text: z.string().min(10).max(500),
      }),
    )
    .length(4),
});
export type AnnouncementOut = z.infer<typeof AnnouncementSchema>;

export const AccessibilityExplanationSchema = z.object({
  explanation: z.string().min(10).max(700),
  stepByStep: z.array(z.string().max(240)).min(1).max(10),
  reassurance: z.string().max(300),
});
export type AccessibilityExplanationOut = z.infer<typeof AccessibilityExplanationSchema>;

export const TransportAdvisorySchema = z.object({
  headline: z.string().min(5).max(140),
  advisory: z.string().min(10).max(600),
  recommendedExits: z.array(z.string().max(120)).max(4),
  expectedDelayMinutes: z.number().int().min(0).max(240),
});
export type TransportAdvisoryOut = z.infer<typeof TransportAdvisorySchema>;

export const SustainabilityRecommendationSchema = z.object({
  headline: z.string().min(5).max(140),
  explanation: z.string().min(10).max(600),
  actions: z.array(z.string().max(200)).min(1).max(5),
});
export type SustainabilityRecommendationOut = z.infer<typeof SustainabilityRecommendationSchema>;

/** Task registry: route key → schema. */
export const TASK_SCHEMAS = {
  incident: IncidentExtractionSchema,
  'fan-intent': FanIntentSchema,
  'route-explanation': RouteExplanationSchema,
  'situation-brief': SituationBriefSchema,
  announcement: AnnouncementSchema,
  'accessibility-explanation': AccessibilityExplanationSchema,
  'transport-advisory': TransportAdvisorySchema,
  'sustainability-recommendation': SustainabilityRecommendationSchema,
} as const;

export type AiTaskKind = keyof typeof TASK_SCHEMAS;
