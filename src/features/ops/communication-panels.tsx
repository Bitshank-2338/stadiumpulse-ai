/** StadiumPulse AI — announcements, environment, and audit panels. */
import { useState } from 'react';
import { useStadiumStore } from '../../store/stadium-store';
import { sustainabilityFallback, transportAdvisoryFallback } from '../../domain/advisories';
import type { AiProvenance } from '../../types/domain';
import { nodeLabel } from '../../store/selectors';
import { aiClient } from '../../ai/client';
import { ProvenanceBadge } from '../../components/provenance-badge';
import type { SustainabilityRecommendationOut, TransportAdvisoryOut } from '../../ai/schemas';

export function AnnouncementCenter() {
  const announcements = useStadiumStore((s) => s.announcements);
  const approveAnnouncement = useStadiumStore((s) => s.approveAnnouncement);
  const publishAnnouncement = useStadiumStore((s) => s.publishAnnouncement);

  return (
    <section className="sp-card" aria-labelledby="annc-heading">
      <h3 id="annc-heading">Announcement center</h3>
      {announcements.length === 0 ? (
        <p className="sp-muted">
          No announcements yet. Draft one from an incident in the queue.
        </p>
      ) : (
        <ul className="sp-list">
          {announcements.map((a) => (
            <li key={a.id} className="sp-card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{a.title}</strong>
                <span>
                  <span className={`sp-badge ${a.status === 'published' ? 'sp-badge-healthy' : a.status === 'approved' ? 'sp-badge-cyan' : 'sp-badge-caution'}`}>
                    {a.status}
                  </span>{' '}
                  <ProvenanceBadge provenance={a.provenance} fallbackLabel={a.provenance} />
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
  );
}

export function EnvironmentPanel() {
  const facilities = useStadiumStore((s) => s.facilities);
  const transport = useStadiumStore((s) => s.transport);
  const sustainability = useStadiumStore((s) => s.sustainability);
  const crowd = useStadiumStore((s) => s.crowd);
  const appendAudit = useStadiumStore((s) => s.appendAudit);

  const [transportAdvisory, setTransportAdvisory] = useState<TransportAdvisoryOut | null>(null);
  const [transportProvenance, setTransportProvenance] = useState<AiProvenance>('fallback');
  const [transportLoading, setTransportLoading] = useState(false);

  const [sustainabilityAdvisory, setSustainabilityAdvisory] =
    useState<SustainabilityRecommendationOut | null>(null);
  const [sustainabilityProvenance, setSustainabilityProvenance] = useState<AiProvenance>('fallback');
  const [sustainabilityLoading, setSustainabilityLoading] = useState(false);

  const generateTransportAdvisory = async (): Promise<void> => {
    if (transportLoading) return;
    setTransportLoading(true);
    const s = useStadiumStore.getState();
    try {
      const result = await aiClient.transportAdvisory(
        { transport: s.transport },
        () => transportAdvisoryFallback(s.transport),
      );
      setTransportAdvisory(result.data);
      setTransportProvenance(result.provenance);
      appendAudit(
        'operator',
        'transport_advisory_generated',
        result.data.headline,
      );
    } finally {
      setTransportLoading(false);
    }
  };

  const generateSustainabilityAnalysis = async (): Promise<void> => {
    if (sustainabilityLoading) return;
    setSustainabilityLoading(true);
    const s = useStadiumStore.getState();
    try {
      const result = await aiClient.sustainabilityRecommendation(
        { sustainability: s.sustainability },
        () => sustainabilityFallback(s.sustainability),
      );
      setSustainabilityAdvisory(result.data);
      setSustainabilityProvenance(result.provenance);
      appendAudit(
        'operator',
        'sustainability_recommendation_generated',
        result.data.headline,
      );
    } finally {
      setSustainabilityLoading(false);
    }
  };

  const outages = Object.values(facilities).filter((f) => f.status === 'outage');

  // Text equivalent of the 3D crowd-heat overlay â€” per-zone occupancy, busiest first.
  const crowdRows = Object.entries(crowd)
    .map(([zoneId, intensity]) => ({ zoneId, intensity }))
    .sort((a, b) => b.intensity - a.intensity);

  return (
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
          Metro: <span className={`sp-badge ${transport.metroStatus === 'normal' ? 'sp-badge-healthy' : 'sp-badge-caution'}`}>{transport.metroStatus}</span>{' '}
          Shuttle: <span className={`sp-badge ${transport.shuttleStatus === 'normal' ? 'sp-badge-healthy' : 'sp-badge-cyan'}`}>{transport.shuttleStatus}</span>
        </li>
        {transport.advisories.map((adv) => (
          <li key={adv} className="sp-muted"><span aria-hidden="true">ðŸš‡</span> {adv}</li>
        ))}
        {Object.entries(sustainability.wasteFill).map(([id, fill]) => (
          <li key={id}>
            {nodeLabel(id)} waste:{' '}
            <span className={`sp-badge ${fill > 0.8 ? 'sp-badge-urgent' : fill > 0.6 ? 'sp-badge-caution' : 'sp-badge-healthy'}`}>
              {Math.round(fill * 100)}%
            </span>
          </li>
        ))}
        {sustainability.alerts.map((a) => (
          <li key={a} className="sp-muted"><span aria-hidden="true">â™»ï¸</span> {a}</li>
        ))}
      </ul>

      <h4 id="crowd-load-heading" style={{ margin: '10px 0 4px', fontSize: 13 }}>
        Crowd load by zone
      </h4>
      <ul className="sp-list" aria-labelledby="crowd-load-heading">
        {crowdRows.map((r) => (
          <li key={r.zoneId} className="sp-muted">
            {nodeLabel(r.zoneId)} â€” {Math.round(r.intensity * 100)}%
          </li>
        ))}
      </ul>

      <div className="sp-row sp-row-mt">
        <button
          type="button"
          className="sp-btn"
          disabled={transportLoading}
          onClick={() => void generateTransportAdvisory()}
        >
          {transportLoading ? 'Generatingâ€¦' : 'Transport advisory'}
        </button>
        <button
          type="button"
          className="sp-btn"
          disabled={sustainabilityLoading}
          onClick={() => void generateSustainabilityAnalysis()}
        >
          {sustainabilityLoading ? 'Analyzingâ€¦' : 'Sustainability analysis'}
        </button>
      </div>

      {transportAdvisory && (
        <div className="sp-card" style={{ marginTop: 10, padding: 10 }} aria-live="polite">
          <p>
            <strong>{transportAdvisory.headline}</strong> <ProvenanceBadge provenance={transportProvenance} />
          </p>
          <p>{transportAdvisory.advisory}</p>
          {transportAdvisory.recommendedExits.length > 0 && (
            <p className="sp-muted">
              Recommended exits: {transportAdvisory.recommendedExits.join(', ')}
            </p>
          )}
          <p className="sp-muted">Expected delay: {transportAdvisory.expectedDelayMinutes} min</p>
        </div>
      )}

      {sustainabilityAdvisory && (
        <div className="sp-card" style={{ marginTop: 10, padding: 10 }} aria-live="polite">
          <p>
            <strong>{sustainabilityAdvisory.headline}</strong> <ProvenanceBadge provenance={sustainabilityProvenance} />
          </p>
          <p>{sustainabilityAdvisory.explanation}</p>
          <ul className="sp-list">
            {sustainabilityAdvisory.actions.map((a) => (
              <li key={a}>â€¢ {a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function AuditLog() {
  const auditLog = useStadiumStore((s) => s.auditLog);

  return (
    <section className="sp-card" aria-labelledby="audit-heading">
      <h3 id="audit-heading">Audit log</h3>
      {auditLog.length === 0 ? (
        <p className="sp-muted">No entries yet.</p>
      ) : (
        <ul className="sp-list" style={{ fontFamily: 'var(--sp-font-mono)', fontSize: 12 }}>
          {[...auditLog].reverse().slice(0, 30).map((e) => (
            <li key={e.id}>
              {new Date(e.at).toLocaleTimeString()} Â· {e.actor} Â·{' '}
              {e.action.replace(/_/g, ' ')} Â· {e.detail}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

