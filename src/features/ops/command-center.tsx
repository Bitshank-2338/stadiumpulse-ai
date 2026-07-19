/**
 * StadiumPulse AI — Operations Command Center.
 * Original StadiumPulse AI code.
 */

import { useState } from 'react';
import { useStadiumStore } from '../../store/stadium-store';
import { computeHealth } from '../../domain/health';
import { draftAnnouncementFallback } from '../../domain/announcements';
import { HIGH_RISK_CATEGORIES } from '../../types/domain';
import type { AiProvenance, Incident, TeamId } from '../../types/domain';
import { nodeLabel } from '../../store/selectors';
import { aiClient } from '../../ai/client';
import type { SituationBriefOut } from '../../ai/schemas';

const TEAMS: TeamId[] = [
  'crowd-operations',
  'medical-response',
  'security',
  'accessibility-support',
  'facilities-maintenance',
  'sustainability',
  'transport-coordination',
  'guest-services',
];

const STATUS_BADGE: Record<Incident['status'], string> = {
  reported: 'sp-badge-urgent',
  acknowledged: 'sp-badge-caution',
  assigned: 'sp-badge-caution',
  in_progress: 'sp-badge-cyan',
  resolved: 'sp-badge-healthy',
  rejected: 'sp-badge-muted',
};

function healthBadge(v: number): string {
  return v > 75 ? 'sp-badge-healthy' : v > 50 ? 'sp-badge-caution' : 'sp-badge-urgent';
}

function IncidentCard({ incident }: { incident: Incident }) {
  const acknowledgeIncident = useStadiumStore((s) => s.acknowledgeIncident);
  const assignTeam = useStadiumStore((s) => s.assignTeam);
  const approveAction = useStadiumStore((s) => s.approveAction);
  const rejectAction = useStadiumStore((s) => s.rejectAction);
  const addIncidentNote = useStadiumStore((s) => s.addIncidentNote);
  const resolveIncident = useStadiumStore((s) => s.resolveIncident);
  const reopenIncident = useStadiumStore((s) => s.reopenIncident);
  const addAnnouncement = useStadiumStore((s) => s.addAnnouncement);

  const [note, setNote] = useState('');
  const [resolveBlocked, setResolveBlocked] = useState(false);
  const [announced, setAnnounced] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const highRisk = HIGH_RISK_CATEGORIES.includes(incident.category);
  const closed = incident.status === 'resolved' || incident.status === 'rejected';

  const handleResolve = (): void => {
    const ok = resolveIncident(incident.id, 'operator');
    setResolveBlocked(!ok);
  };

  const handleAnnounce = async (): Promise<void> => {
    if (drafting) return;
    setDrafting(true);
    try {
      const result = await aiClient.announcement(
        {
          incident: {
            category: incident.category,
            severity: incident.severity,
            summary: incident.summary,
            location: nodeLabel(incident.locationId),
            approvedActions: incident.approvedActions.map(
              (i) => incident.recommendedActions[i],
            ),
          },
        },
        () => draftAnnouncementFallback(incident),
      );
      addAnnouncement({
        incidentId: incident.id,
        title: result.data.title,
        translations: result.data.translations,
        provenance: result.provenance,
      });
      setAnnounced(true);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <li className="sp-card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong>{incident.summary}</strong>
        <span>
          <span className={`sp-badge ${STATUS_BADGE[incident.status]}`}>
            {incident.status.replace(/_/g, ' ')}
          </span>{' '}
          <span className="sp-provenance sp-badge sp-badge-muted">{incident.provenance}</span>
        </span>
      </div>
      <p className="sp-muted" style={{ margin: '4px 0' }}>
        {incident.id} · {nodeLabel(incident.locationId)} · {incident.severity} ·{' '}
        {incident.recommendedTeam}
        {highRisk && (
          <span className="sp-badge sp-badge-urgent" style={{ marginLeft: 6 }}>
            high-risk: human approval required
          </span>
        )}
      </p>

      {!closed && (
        <>
          {incident.recommendedActions.length > 0 && (
            <ul className="sp-list" style={{ margin: '6px 0' }}>
              {incident.recommendedActions.map((a, idx) => {
                const approved = incident.approvedActions.includes(idx);
                const rejected = incident.rejectedActions.includes(idx);
                return (
                  <li key={a} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 160 }}>
                      {a}{' '}
                      {approved && <span className="sp-badge sp-badge-healthy">approved</span>}
                      {rejected && <span className="sp-badge sp-badge-muted">rejected</span>}
                    </span>
                    {!approved && !rejected && (
                      <>
                        <button
                          type="button"
                          className="sp-btn"
                          style={{ minHeight: 32, padding: '2px 10px', fontSize: 12 }}
                          onClick={() => approveAction(incident.id, idx, 'operator')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="sp-btn"
                          style={{ minHeight: 32, padding: '2px 10px', fontSize: 12 }}
                          onClick={() => rejectAction(incident.id, idx, 'operator')}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {incident.status === 'reported' && (
              <button
                type="button"
                className="sp-btn"
                style={{ minHeight: 36 }}
                onClick={() => acknowledgeIncident(incident.id, 'operator')}
              >
                Acknowledge
              </button>
            )}
            <label className="sp-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Assign
              <select
                className="sp-select"
                style={{ minHeight: 36, width: 'auto' }}
                value={incident.assignedTeam ?? ''}
                onChange={(e) => assignTeam(incident.id, e.target.value as TeamId, 'operator')}
                aria-label={`Assign team for ${incident.id}`}
              >
                <option value="" disabled>
                  team…
                </option>
                {TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="sp-btn"
              style={{ minHeight: 36 }}
              onClick={() => void handleAnnounce()}
              disabled={announced || drafting}
            >
              {drafting ? 'Drafting…' : announced ? 'Announcement drafted' : 'Draft announcement'}
            </button>
            <button
              type="button"
              className="sp-btn sp-btn-primary"
              style={{ minHeight: 36 }}
              onClick={handleResolve}
            >
              Resolve
            </button>
          </div>
          {resolveBlocked && (
            <p role="alert" style={{ color: 'var(--sp-caution)', margin: '6px 0 0' }}>
              Cannot resolve yet: {incident.status === 'reported'
                ? 'acknowledge the incident first.'
                : 'this high-risk incident needs an explicit operator decision (approve an action or add a note).'}
            </p>
          )}

          <form
            style={{ display: 'flex', gap: 6, marginTop: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim()) {
                addIncidentNote(incident.id, 'operator', note.trim());
                setNote('');
                setResolveBlocked(false);
              }
            }}
          >
            <input
              className="sp-input"
              style={{ minHeight: 36 }}
              placeholder="Add operator note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label={`Note for ${incident.id}`}
            />
            <button type="submit" className="sp-btn" style={{ minHeight: 36 }} disabled={!note.trim()}>
              Note
            </button>
          </form>
        </>
      )}

      {incident.status === 'resolved' && (
        <button
          type="button"
          className="sp-btn"
          style={{ minHeight: 32, marginTop: 6 }}
          onClick={() => reopenIncident(incident.id, 'operator')}
        >
          Reopen
        </button>
      )}

      {incident.notes.length > 0 && (
        <ul className="sp-list" style={{ marginTop: 6 }}>
          {incident.notes.map((n) => (
            <li key={`${n.at}-${n.text}`} className="sp-muted">
              📝 {n.text}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommandCenter() {
  const store = useStadiumStore();
  const health = computeHealth(store);
  const approveAnnouncement = useStadiumStore((s) => s.approveAnnouncement);
  const publishAnnouncement = useStadiumStore((s) => s.publishAnnouncement);

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
          headline: `Stadium health ${h.overall}/100 — ${openIncidents.length} open incident(s)`,
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

  const open = store.incidents.filter(
    (i) => i.status !== 'resolved' && i.status !== 'rejected',
  );
  const closedIncidents = store.incidents.filter(
    (i) => i.status === 'resolved' || i.status === 'rejected',
  );
  const pendingReview = open.filter(
    (i) => i.requiresHumanApproval && i.approvedActions.length === 0,
  );
  const outages = Object.values(store.facilities).filter((f) => f.status === 'outage');

  return (
    <>
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

      <section className="sp-card" aria-labelledby="brief-heading">
        <h3 id="brief-heading">Situation brief</h3>
        <button
          type="button"
          className="sp-btn sp-btn-primary"
          disabled={briefing}
          onClick={() => void generateBrief()}
        >
          {briefing ? 'Generating…' : brief ? 'Regenerate brief' : 'Generate situation brief'}
        </button>
        {brief && (
          <div style={{ marginTop: 10 }} aria-live="polite">
            <p>
              <strong>{brief.headline}</strong>{' '}
              <span className={`sp-provenance sp-badge ${briefProvenance === 'gemini' ? 'sp-badge-cyan' : 'sp-badge-muted'}`}>
                {briefProvenance === 'gemini' ? 'Gemini' : 'fallback'}
              </span>
            </p>
            <p>{brief.situation}</p>
            <h4 style={{ margin: '8px 0 4px' }}>Observed facts</h4>
            <ul className="sp-list">
              {brief.observedFacts.map((f) => (
                <li key={f}>• {f}</li>
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

      <section className="sp-card" aria-labelledby="queue-heading">
        <h3 id="queue-heading">Incident queue ({open.length})</h3>
        {open.length === 0 ? (
          <p className="sp-muted">No active incidents. All clear.</p>
        ) : (
          <ul className="sp-list">
            {open.map((i) => (
              <IncidentCard key={i.id} incident={i} />
            ))}
          </ul>
        )}
        {closedIncidents.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary className="sp-muted">Closed ({closedIncidents.length})</summary>
            <ul className="sp-list" style={{ marginTop: 6 }}>
              {closedIncidents.map((i) => (
                <IncidentCard key={i.id} incident={i} />
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="sp-card" aria-labelledby="annc-heading">
        <h3 id="annc-heading">Announcement center</h3>
        {store.announcements.length === 0 ? (
          <p className="sp-muted">
            No announcements yet. Draft one from an incident in the queue.
          </p>
        ) : (
          <ul className="sp-list">
            {store.announcements.map((a) => (
              <li key={a.id} className="sp-card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{a.title}</strong>
                  <span>
                    <span className={`sp-badge ${a.status === 'published' ? 'sp-badge-healthy' : a.status === 'approved' ? 'sp-badge-cyan' : 'sp-badge-caution'}`}>
                      {a.status}
                    </span>{' '}
                    <span className="sp-provenance sp-badge sp-badge-muted">{a.provenance}</span>
                  </span>
                </div>
                <ul className="sp-list" style={{ marginTop: 6 }}>
                  {a.translations.map((tr) => (
                    <li key={tr.language}>
                      <span className="sp-badge sp-badge-muted">{tr.language.toUpperCase()}</span>{' '}
                      <span lang={tr.language}>{tr.text}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {a.status === 'draft' && (
                    <button
                      type="button"
                      className="sp-btn"
                      onClick={() => approveAnnouncement(a.id, 'operator')}
                    >
                      Approve
                    </button>
                  )}
                  {a.status === 'approved' && (
                    <button
                      type="button"
                      className="sp-btn sp-btn-primary"
                      onClick={() => publishAnnouncement(a.id, 'operator')}
                    >
                      Publish to all channels
                    </button>
                  )}
                  {a.status === 'published' && (
                    <span className="sp-muted">
                      Live in Fan Companion since{' '}
                      {a.publishedAt ? new Date(a.publishedAt).toLocaleTimeString() : ''}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sp-card" aria-labelledby="env-heading">
        <h3 id="env-heading">Environment</h3>
        <ul className="sp-list">
          <li>
            Accessibility outages:{' '}
            {outages.length === 0 ? (
              <span className="sp-badge sp-badge-healthy">none</span>
            ) : (
              outages.map((f) => (
                <span key={f.nodeId} className="sp-badge sp-badge-urgent" style={{ marginRight: 4 }}>
                  {nodeLabel(f.nodeId)}
                </span>
              ))
            )}
          </li>
          <li>
            Metro: <span className={`sp-badge ${store.transport.metroStatus === 'normal' ? 'sp-badge-healthy' : 'sp-badge-caution'}`}>{store.transport.metroStatus}</span>{' '}
            Shuttle: <span className={`sp-badge ${store.transport.shuttleStatus === 'normal' ? 'sp-badge-healthy' : 'sp-badge-cyan'}`}>{store.transport.shuttleStatus}</span>
          </li>
          {store.transport.advisories.map((adv) => (
            <li key={adv} className="sp-muted">🚇 {adv}</li>
          ))}
          {Object.entries(store.sustainability.wasteFill).map(([id, fill]) => (
            <li key={id}>
              {nodeLabel(id)} waste:{' '}
              <span className={`sp-badge ${fill > 0.8 ? 'sp-badge-urgent' : fill > 0.6 ? 'sp-badge-caution' : 'sp-badge-healthy'}`}>
                {Math.round(fill * 100)}%
              </span>
            </li>
          ))}
          {store.sustainability.alerts.map((a) => (
            <li key={a} className="sp-muted">♻️ {a}</li>
          ))}
        </ul>
      </section>

      <section className="sp-card" aria-labelledby="audit-heading">
        <h3 id="audit-heading">Audit log</h3>
        {store.auditLog.length === 0 ? (
          <p className="sp-muted">No entries yet.</p>
        ) : (
          <ul className="sp-list" style={{ fontFamily: 'var(--sp-font-mono)', fontSize: 12 }}>
            {[...store.auditLog].reverse().slice(0, 30).map((e) => (
              <li key={e.id}>
                {new Date(e.at).toLocaleTimeString()} · {e.actor} ·{' '}
                {e.action.replace(/_/g, ' ')} · {e.detail}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
