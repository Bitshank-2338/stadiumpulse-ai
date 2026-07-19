/**
 * StadiumPulse AI — central AI configuration.
 * Original StadiumPulse AI code.
 *
 * Single source of truth for model identifiers and limits — no raw model
 * names anywhere else in the codebase. Server reads GEMINI_MODEL to override.
 */

export const AI_CONFIG = {
  /**
   * Safe cheap default. Flash-Lite is the lowest-cost Gemini tier suitable
   * for structured extraction. Override with GEMINI_MODEL env var.
   */
  defaultModel: 'gemini-2.5-flash-lite',

  /** Per-request timeout (ms) before deterministic fallback. */
  timeoutMs: 12_000,

  /** One repair attempt after invalid JSON/schema, then fallback. */
  maxRepairAttempts: 1,

  temperature: 0.3,
  maxOutputTokens: 1024,

  /**
   * Server-side rate limiting (cheap-model quota protection).
   * Requests beyond the budget return 429 and the client falls back.
   */
  rateLimit: {
    maxRequestsPerMinute: 8,
    minIntervalMs: 1_500,
  },

  featureFlags: {
    fanIntent: true,
    incidentExtraction: true,
    situationBrief: true,
    announcements: true,
    routeExplanation: true,
    accessibilityExplanation: true,
    transportAdvisory: true,
    sustainabilityRecommendation: true,
  },

  fallback: {
    /** Always available; provenance is surfaced in the UI. */
    enabled: true,
    label: 'deterministic fallback',
  },
} as const;

export function resolveModel(envModel: string | undefined): string {
  const m = envModel?.trim();
  return m && m.length > 0 ? m : AI_CONFIG.defaultModel;
}
