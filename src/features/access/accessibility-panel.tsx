/**
 * StadiumPulse AI — accessibility preferences panel.
 * Original StadiumPulse AI code.
 */

import { useStadiumStore } from '../../store/stadium-store';
import type { AccessibilityPreferences } from '../../types/domain';

const PREFERENCE_LABELS: {
  key: keyof AccessibilityPreferences;
  label: string;
  hint: string;
}[] = [
  { key: 'wheelchair', label: 'Wheelchair accessible', hint: 'Only step-free routes with elevators and ramps' },
  { key: 'stepFree', label: 'Step-free', hint: 'No stairs or escalators on any route' },
  { key: 'avoidStairs', label: 'Avoid stairs', hint: 'Prefer elevators, escalators and ramps' },
  { key: 'avoidEscalators', label: 'Avoid escalators', hint: 'Prefer elevators and stairs' },
  { key: 'reducedSensory', label: 'Reduced sensory', hint: 'Quieter, calmer routes away from loud areas' },
  { key: 'hearingLoopPriority', label: 'Hearing-loop priority', hint: 'Rank hearing-loop facilities first' },
  { key: 'companionAssistance', label: 'Companion assistance', hint: 'Guidance written for you and a companion' },
  { key: 'extraWalkingTime', label: 'Extra walking time', hint: 'Time estimates increased by 40%' },
  { key: 'accessibleRestroomPriority', label: 'Accessible-restroom priority', hint: 'Restroom searches return accessible facilities first' },
  { key: 'reducedMotion', label: 'Reduced motion', hint: 'Minimal animation in the app and 3D view' },
  { key: 'highContrast', label: 'High contrast', hint: 'Stronger text and border contrast' },
];

export function AccessibilityPanel() {
  const prefs = useStadiumStore((s) => s.userPreferences);
  const setPreferences = useStadiumStore((s) => s.setPreferences);

  return (
    <section className="sp-card" aria-labelledby="a11y-heading">
      <h2 id="a11y-heading">Accessibility preferences</h2>
      <p className="sp-muted">
        Every preference changes route computation, facility ranking and how
        guidance is presented.
      </p>
      <div role="group" aria-labelledby="a11y-heading">
        {PREFERENCE_LABELS.map(({ key, label, hint }) => (
          <div key={key} className="sp-toggle-row">
            <span>
              <span style={{ display: 'block' }}>{label}</span>
              <span className="sp-muted" id={`hint-${key}`}>
                {hint}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              aria-label={label}
              aria-describedby={`hint-${key}`}
              className="sp-btn"
              style={{
                minWidth: 64,
                color: prefs[key] ? 'var(--sp-cyan-strong)' : 'var(--sp-text-muted)',
                borderColor: prefs[key] ? 'var(--sp-cyan)' : 'var(--sp-border)',
              }}
              onClick={() => setPreferences({ [key]: !prefs[key] })}
            >
              {prefs[key] ? 'On' : 'Off'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
