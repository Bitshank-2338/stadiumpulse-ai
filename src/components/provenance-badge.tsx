/**
 * StadiumPulse AI — provenance badge.
 * Original StadiumPulse AI code.
 *
 * Single source for the "where did this answer come from" badge shown next to
 * every AI-influenced result. Cyan = live Gemini, muted = deterministic
 * fallback (or a custom label such as "rules").
 */

import type { AiProvenance } from '../types/domain';

interface ProvenanceBadgeProps {
  provenance: AiProvenance;
  /** Label when provenance is not 'gemini' (default "fallback"). */
  fallbackLabel?: string;
}

export function ProvenanceBadge({ provenance, fallbackLabel = 'fallback' }: ProvenanceBadgeProps) {
  const isGemini = provenance === 'gemini';
  return (
    <span className={`sp-provenance sp-badge ${isGemini ? 'sp-badge-cyan' : 'sp-badge-muted'}`}>
      {isGemini ? 'Gemini' : fallbackLabel}
    </span>
  );
}
