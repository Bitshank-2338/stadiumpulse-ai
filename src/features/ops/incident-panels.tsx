/** StadiumPulse AI — incident operations panels. */
import { useState } from 'react';
import { useStadiumStore } from '../../store/stadium-store';
import { draftAnnouncementFallback } from '../../domain/announcements';
import { HIGH_RISK_CATEGORIES } from '../../types/domain';
import type { Incident, TeamId } from '../../types/domain';
import { nodeLabel } from '../../store/selectors';
import { aiClient } from '../../ai/client';
import { ProvenanceBadge } from '../../components/provenance-badge';

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
          <ProvenanceBadge provenance={incident.provenance} fallbackLabel={incident.provenance} />
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
                          className="sp-btn sp-btn-sm"
                          onClick={() => approveAction(incident.id, idx, 'operator')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="sp-btn sp-btn-sm"
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

          <div className="sp-row" style={{ marginTop: 6 }}>
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
              <span aria-hidden="true">📝</span> {n.text}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
export function IncidentQueue() {
  const incidents = useStadiumStore((s) => s.incidents);
  const open = incidents.filter(
    (i) => i.status !== 'resolved' && i.status !== 'rejected',
  );
  const closedIncidents = incidents.filter(
    (i) => i.status === 'resolved' || i.status === 'rejected',
  );

  return (
    <section className="sp-card" aria-labelledby="queue-heading">
      <h3 id="queue-heading" aria-live="polite">Incident queue ({open.length})</h3>
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
  );
}
