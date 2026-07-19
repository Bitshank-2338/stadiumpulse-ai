/**
 * StadiumPulse AI — Fan Companion (mobile-first).
 * Original StadiumPulse AI code.
 */

import { useMemo, useState } from 'react';
import { useStadiumStore } from '../../store/stadium-store';
import { computeRoute, rankFacilities } from '../../domain/routing';
import type { RoutingContext } from '../../domain/routing';
import { interpretFanRequest } from '../../domain/fan-intent';
import { STADIUM_GRAPH } from '../../data/stadium-graph';
import { nodeLabel } from '../../store/selectors';
import { aiClient } from '../../ai/client';
import type { AiProvenance, RouteOutcome, RoutingMode } from '../../types/domain';

const ORIGIN_OPTIONS = Object.values(STADIUM_GRAPH.nodes)
  .filter((n) => n.kind === 'gate' || n.kind === 'seating_entrance' || n.kind === 'concourse')
  .map((n) => ({ id: n.id, label: n.label }));

const QUICK_ACTIONS: { label: string; request: string }[] = [
  { label: 'Find my seat', request: 'take me to section 315' },
  { label: 'Least crowded gate', request: 'find the least crowded entrance' },
  { label: 'Nearest restroom', request: 'nearest restroom' },
  { label: 'Accessible restroom', request: 'nearest accessible restroom' },
  { label: 'Water refill', request: 'water refill' },
  { label: 'Food (short queue)', request: 'food with the shortest queue' },
  { label: 'First aid', request: 'first aid' },
  { label: 'Quiet room', request: 'quiet room' },
  { label: 'Metro exit', request: 'which exit for the metro' },
  { label: 'Emergency help', request: 'emergency assistance' },
];

function formatEta(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  return `${min} min`;
}

export function FanCompanion() {
  const crowd = useStadiumStore((s) => s.crowd);
  const facilities = useStadiumStore((s) => s.facilities);
  const prefs = useStadiumStore((s) => s.userPreferences);
  const announcements = useStadiumStore((s) => s.announcements);
  const setRoute = useStadiumStore((s) => s.setRoute);
  const reportIncident = useStadiumStore((s) => s.reportIncident);

  const [origin, setOrigin] = useState('gate-a');
  const [text, setText] = useState('');
  const [understood, setUnderstood] = useState<string | null>(null);
  const [provenance, setProvenance] = useState<AiProvenance>('fallback');
  const [thinking, setThinking] = useState(false);
  const [outcome, setOutcome] = useState<RouteOutcome | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [emergencySent, setEmergencySent] = useState(false);

  const ctx: RoutingContext = useMemo(
    () => ({ graph: STADIUM_GRAPH, crowd, facilities }),
    [crowd, facilities],
  );

  const published = announcements.filter((a) => a.status === 'published');

  const runRoute = (toNodeId: string, mode: RoutingMode): void => {
    const result = computeRoute(ctx, {
      fromNodeId: origin,
      toNodeId,
      mode,
      preferences: prefs,
    });
    setOutcome(result);
    if (result.ok) {
      setRoute({
        id: 'fan-route',
        ownerRole: prefs.wheelchair || prefs.stepFree ? 'accessibility' : 'fan',
        request: { fromNodeId: origin, toNodeId, mode, preferences: prefs },
        outcome: result,
        createdAt: Date.now(),
      });
      // Ask Gemini to explain the deterministically computed route.
      void aiClient
        .explainRoute(
          {
            from: nodeLabel(origin),
            to: nodeLabel(toNodeId),
            mode,
            distanceMeters: result.distanceMeters,
            etaSeconds: result.etaSeconds,
            stepFree: result.stepFree,
            usesElevator: result.usesElevator,
            stops: result.nodeIds.map(nodeLabel),
            notes: result.notes,
            preferences: prefs,
          },
          () => ({
            explanation: `Head from ${nodeLabel(origin)} to ${nodeLabel(toNodeId)} — about ${Math.max(1, Math.round(result.etaSeconds / 60))} minutes over ${result.distanceMeters} m.`,
            accessibilityNotes: result.notes,
          }),
        )
        .then((r) => setExplanation(r.data.explanation));
    } else {
      setExplanation(null);
    }
  };

  const handleRequest = async (request: string): Promise<void> => {
    if (thinking) return;
    setEmergencySent(false);
    setThinking(true);
    let intent;
    try {
      const result = await aiClient.interpretFan(
        request,
        { origin, preferences: prefs },
        () => interpretFanRequest(request, prefs),
      );
      intent = result.data;
      setProvenance(result.provenance);
    } finally {
      setThinking(false);
    }
    setUnderstood(intent.understood);

    switch (intent.kind) {
      case 'route_to_section':
      case 'route_to_node':
        if (intent.targetNodeId) runRoute(intent.targetNodeId, intent.mode);
        break;
      case 'find_facility': {
        const ranked = rankFacilities(
          ctx,
          origin,
          intent.facilityKinds ?? [],
          intent.mode,
          prefs,
        );
        const best = ranked.find((r) => r.outcome.ok);
        if (best) {
          setOutcome(best.outcome);
          if (best.outcome.ok) {
            setRoute({
              id: 'fan-route',
              ownerRole: 'fan',
              request: {
                fromNodeId: origin,
                toNodeId: best.nodeId,
                mode: intent.mode,
                preferences: prefs,
              },
              outcome: best.outcome,
              createdAt: Date.now(),
            });
          }
        } else {
          setOutcome(
            ranked[0]?.outcome ?? {
              ok: false,
              reason: 'no_route',
              explanation: 'No matching facility is reachable right now. The nearest assistance desk can help.',
            },
          );
        }
        break;
      }
      case 'least_crowded_gate': {
        const gates = Object.values(STADIUM_GRAPH.nodes).filter((n) => n.kind === 'gate');
        const sorted = [...gates].sort(
          (a, b) => (crowd[a.zoneId] ?? 0) - (crowd[b.zoneId] ?? 0),
        );
        const best = sorted[0];
        if (best) runRoute(best.id, 'least_crowded');
        break;
      }
      case 'emergency_assistance': {
        reportIncident(
          {
            category: 'other',
            severity: 'high',
            summary: `Fan requested emergency assistance near ${nodeLabel(origin)}`,
            locationId: origin,
            peopleAffectedEstimate: 1,
            accessibilityImpact: 'none',
            operationalImpact: 'low',
            recommendedTeam: 'guest-services',
            recommendedActions: ['Send nearest staff member to the fan'],
            requiresHumanApproval: true,
            missingInformation: ['Nature of the emergency'],
            confidence: 1,
          },
          { rawReport: request, reportedBy: 'fan', provenance: 'fallback' },
        );
        setEmergencySent(true);
        setOutcome(null);
        break;
      }
      case 'unknown':
        setOutcome(null);
        break;
    }
  };

  return (
    <>
      <section className="sp-card" aria-labelledby="fan-heading">
        <h2 id="fan-heading">Fan Companion</h2>
        <label htmlFor="fan-origin" className="sp-muted">
          I am at
        </label>
        <select
          id="fan-origin"
          className="sp-select"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        >
          {ORIGIN_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void handleRequest(text);
          }}
          style={{ marginTop: 10 }}
        >
          <label htmlFor="fan-request" className="sp-muted">
            Ask for anything
          </label>
          <input
            id="fan-request"
            className="sp-input"
            placeholder='e.g. "Take me to Section 315 without stairs"'
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="sp-btn sp-btn-primary"
            style={{ marginTop: 8, width: '100%' }}
            disabled={thinking}
          >
            {thinking ? 'Interpreting…' : 'Get guidance'}
          </button>
        </form>

        <div className="sp-grid-2" style={{ marginTop: 10 }}>
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.label}
              type="button"
              className={`sp-btn${qa.label === 'Emergency help' ? ' sp-btn-danger' : ''}`}
              onClick={() => void handleRequest(qa.request)}
            >
              {qa.label}
            </button>
          ))}
        </div>
      </section>

      {understood && (
        <p className="sp-muted" aria-live="polite">
          Understood: {understood}{' '}
          <span className={`sp-provenance sp-badge ${provenance === 'gemini' ? 'sp-badge-cyan' : 'sp-badge-muted'}`}>
            {provenance === 'gemini' ? 'Gemini' : 'rules'}
          </span>
        </p>
      )}

      {emergencySent && (
        <section className="sp-card" role="status" style={{ borderColor: 'var(--sp-caution)' }}>
          <h3>Assistance requested</h3>
          <p>
            Your request reached the operations team. Stay where you are —
            staff are being directed to {nodeLabel(origin)}. If this is a
            medical emergency, alert the nearest steward immediately.
          </p>
        </section>
      )}

      {outcome && !outcome.ok && (
        <section className="sp-card" role="alert" style={{ borderColor: 'var(--sp-caution)' }}>
          <h3>No route</h3>
          <p>{outcome.explanation}</p>
          {outcome.fallbackNodeId && (
            <button
              type="button"
              className="sp-btn sp-btn-primary"
              onClick={() => runRoute(outcome.fallbackNodeId ?? '', 'step_free')}
            >
              Route me to {nodeLabel(outcome.fallbackNodeId)}
            </button>
          )}
        </section>
      )}

      {outcome?.ok && (
        <section className="sp-card" aria-labelledby="route-heading">
          <h3 id="route-heading">
            Your route{' '}
            {outcome.stepFree && <span className="sp-badge sp-badge-cyan">step-free</span>}
          </h3>
          <p>
            <strong>{outcome.distanceMeters} m</strong> · about{' '}
            <strong>{formatEta(outcome.etaSeconds)}</strong>
            {outcome.maxCongestion > 0.7 ? (
              <span className="sp-badge sp-badge-caution" style={{ marginLeft: 8 }}>
                busy
              </span>
            ) : (
              <span className="sp-badge sp-badge-healthy" style={{ marginLeft: 8 }}>
                clear
              </span>
            )}
          </p>
          {explanation && <p style={{ marginTop: 4 }}>{explanation}</p>}
          <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {outcome.nodeIds.map((id) => (
              <li key={id}>{nodeLabel(id)}</li>
            ))}
          </ol>
          {outcome.notes.length > 0 && (
            <ul className="sp-list" style={{ marginTop: 8 }}>
              {outcome.notes.map((n) => (
                <li key={n} className="sp-muted">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {published.length > 0 && (
        <section className="sp-card" aria-labelledby="ann-heading" aria-live="polite">
          <h3 id="ann-heading">Stadium announcements</h3>
          <ul className="sp-list">
            {published.map((a) => (
              <li key={a.id}>
                <strong>{a.title}</strong>
                <p style={{ margin: '4px 0 0' }}>
                  {a.translations.find((tr) => tr.language === 'en')?.text ??
                    a.translations[0]?.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
