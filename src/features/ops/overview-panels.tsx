/** StadiumPulse AI — operations health and situation panels. */
import { useState } from 'react';
import { useStadiumStore } from '../../store/stadium-store';
import { computeHealth } from '../../domain/health';
import type { AiProvenance } from '../../types/domain';
import { nodeLabel } from '../../store/selectors';
import { aiClient } from '../../ai/client';
import { ProvenanceBadge } from '../../components/provenance-badge';
import type { SituationBriefOut } from '../../ai/schemas';

function healthBadge(v: number): string {
  return v > 75 ? 'sp-badge-healthy' : v > 50 ? 'sp-badge-caution' : 'sp-badge-urgent';
}
export function HealthSummary() {
  const store = useStadiumStore();
  const health = computeHealth(store);
  const open = store.incidents.filter(
    (i) => i.status !== 'resolved' && i.status !== 'rejected',
  );
  const pendingReview = open.filter(
    (i) => i.requiresHumanApproval && i.approvedActions.length === 0,
  );

  return (
    <section className="sp-card" aria-labelledby="ops-heading">
      <h2 id="ops-heading">Operations Command Center</h2>
      <p>
        Stadium health:{' '}
        <span className={`sp-badge ${healthBadge(health.overall)}`}>{health.overall}/100</span>
      </p>
      <div className="sp-grid-2" style={{ fontSize: 13 }}>
        <span>Crowd <span className={`sp-badge ${healthBadge(health.crowd)}`}>{health.crowd}</span></span>
        <span>Incidents <span className={`sp-badge ${healthBadge(health.incidents)}`}>{health.incidents}</span></span>
        <span>Accessibility <span className={`sp-badge ${healthBadge(health.accessibility)}`}>{health.accessibility}</span></span>
        <span>Transport <span className={`sp-badge ${healthBadge(health.transport)}`}>{health.transport}</span></span>
        <span>Sustainability <span className={`sp-badge ${healthBadge(health.sustainability)}`}>{health.sustainability}</span></span>
        <span>Pending review <span className={`sp-badge ${pendingReview.length ? 'sp-badge-caution' : 'sp-badge-healthy'}`}>{pendingReview.length}</span></span>
      </div>
    </section>
  );
}

export function SituationBriefPanel() {
  const [brief, setBrief] = useState<SituationBriefOut | null>(null);
  const [briefProvenance, setBriefProvenance] = useState<AiProvenance>('fallback');
  const [briefing, setBriefing] = useState(false);

  const generateBrief = async (): Promise<void> => {
    if (briefing) return;
    setBriefing(true);
    const s = useStadiumStore.getState();
    const h = computeHealth(s);
    const openIncidents = s.incidents
      .filter((i) => i.status !== 'resolved' && i.status !== 'rejected')
      .map((i) => ({
        id: i.id,
        category: i.category,
        severity: i.severity,
        summary: i.summary,
        location: nodeLabel(i.locationId),
        status: i.status,
      }));
    try {
      const result = await aiClient.situationBrief(
        {
          scenario: s.simulation.activeScenario,
          health: h,
          openIncidents,
          crowdHotspots: Object.entries(s.crowd)
            .filter(([, v]) => v > 0.6)
            .map(([zone, v]) => ({ zone, load: v })),
          transport: s.transport,
          sustainability: { alerts: s.sustainability.alerts, wasteFill: s.sustainability.wasteFill },
        },
        () => ({
          headline: `Stadium health ${h.overall}/100 â€” ${openIncidents.length} open incident(s)`,
          situation: `Scenario "${s.simulation.activeScenario.replace(/_/g, ' ')}" active. ${openIncidents.length} incident(s) open. Metro ${s.transport.metroStatus}.`,
          observedFacts: [
            `Health score ${h.overall}/100`,
            ...openIncidents.slice(0, 4).map((i) => `${i.severity} ${i.category} at ${i.location}`),
          ],
          predictions: [],
          recommendedPriorities: openIncidents.slice(0, 3).map((i) => `Address ${i.category} at ${i.location}`),
          requiresOperatorDecision: openIncidents
            .filter((i) => ['medical', 'security', 'missing_person', 'fire'].includes(i.category))
            .map((i) => `Approve response for ${i.id}`),
        }),
      );
      setBrief(result.data);
      setBriefProvenance(result.provenance);
    } finally {
      setBriefing(false);
    }
  };

  return (
    <section className="sp-card" aria-labelledby="brief-heading">
      <h3 id="brief-heading">Situation brief</h3>
      <button
        type="button"
        className="sp-btn sp-btn-primary"
        disabled={briefing}
        onClick={() => void generateBrief()}
      >
        {briefing ? 'Generatingâ€¦' : brief ? 'Regenerate brief' : 'Generate situation brief'}
      </button>
      {brief && (
        <div style={{ marginTop: 10 }} aria-live="polite">
          <p>
            <strong>{brief.headline}</strong> <ProvenanceBadge provenance={briefProvenance} />
          </p>
          <p>{brief.situation}</p>
          <h4 style={{ margin: '8px 0 4px' }}>Observed facts</h4>
          <ul className="sp-list">
            {brief.observedFacts.map((f) => (
              <li key={f}>â€¢ {f}</li>
            ))}
          </ul>
          {brief.predictions.length > 0 && (
            <>
              <h4 style={{ margin: '8px 0 4px' }}>Predictions (speculative)</h4>
              <ul className="sp-list">
                {brief.predictions.map((p) => (
                  <li key={p} className="sp-muted">
                    ~ {p}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4 style={{ margin: '8px 0 4px' }}>Priorities</h4>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {brief.recommendedPriorities.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          {brief.requiresOperatorDecision.length > 0 && (
            <>
              <h4 style={{ margin: '8px 0 4px' }}>Needs your decision</h4>
              <ul className="sp-list">
                {brief.requiresOperatorDecision.map((d) => (
                  <li key={d}>
                    <span className="sp-badge sp-badge-caution">decision</span> {d}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

