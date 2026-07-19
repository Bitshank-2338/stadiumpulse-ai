/**
 * StadiumPulse AI — Volunteer Reporter.
 * Original StadiumPulse AI code.
 */

import { useState } from 'react';
import { useStadiumStore } from '../../store/stadium-store';
import {
  extractIncidentFallback,
  isDuplicateIncident,
} from '../../domain/incident-extraction';
import { STADIUM_GRAPH } from '../../data/stadium-graph';
import { nodeLabel } from '../../store/selectors';
import { aiClient } from '../../ai/client';
import type { AiProvenance, IncidentExtraction } from '../../types/domain';

const LOCATION_OPTIONS = Object.values(STADIUM_GRAPH.nodes).map((n) => ({
  id: n.id,
  label: n.label,
}));

const CATEGORY_SHORTCUTS: { label: string; text: string }[] = [
  { label: 'Crowd', text: 'A large crowd is building up and blocking movement here.' },
  { label: 'Medical', text: 'A person needs medical attention here.' },
  { label: 'Accessibility', text: 'The elevator is not working and wheelchair users cannot pass.' },
  { label: 'Waste', text: 'Trash bins are overflowing here.' },
  { label: 'Missing child', text: 'A child is separated from their family near here.' },
  { label: 'Suspicious item', text: 'There is an unattended bag here.' },
];

const VOICE_SAMPLE =
  'Uh, hi, this is Priya near Gate B — there is a really big queue forming and ' +
  'two wheelchair users are stuck, they cannot get through the corridor at all. ' +
  'It is getting worse quickly.';

const IMPACT_BADGE: Record<string, string> = {
  none: 'sp-badge-muted',
  low: 'sp-badge-healthy',
  medium: 'sp-badge-caution',
  high: 'sp-badge-urgent',
};

export function VolunteerReporter() {
  const incidents = useStadiumStore((s) => s.incidents);
  const reportIncident = useStadiumStore((s) => s.reportIncident);

  const [text, setText] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [preview, setPreview] = useState<IncidentExtraction | null>(null);
  const [provenance, setProvenance] = useState<AiProvenance>('fallback');
  const [analyzing, setAnalyzing] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const analyze = async (): Promise<void> => {
    if (!text.trim() || analyzing) return;
    setAnalyzing(true);
    setSubmittedId(null);
    try {
      const result = await aiClient.extractIncident(
        text,
        locationHint || undefined,
        () => extractIncidentFallback(text, locationHint || undefined),
      );
      // Location hint from the volunteer always wins over model output.
      const extraction: IncidentExtraction = locationHint
        ? { ...result.data, locationId: locationHint }
        : result.data;
      setPreview(extraction);
      setProvenance(result.provenance);
      setDuplicate(isDuplicateIncident(incidents, extraction));
    } finally {
      setAnalyzing(false);
    }
  };

  const confirm = (): void => {
    if (!preview || duplicate) return;
    const incident = reportIncident(preview, {
      rawReport: text,
      reportedBy: 'volunteer',
      provenance,
    });
    setSubmittedId(incident.id);
    setPreview(null);
    setText('');
    setLocationHint('');
  };

  return (
    <>
      <section className="sp-card" aria-labelledby="vol-heading">
        <h2 id="vol-heading">Volunteer Reporter</h2>
        <p className="sp-muted">
          Describe what you see. The system extracts a structured incident for
          the operations team — you confirm before anything is submitted.
        </p>

        <label htmlFor="vol-text" className="sp-muted">
          What is happening?
        </label>
        <textarea
          id="vol-text"
          className="sp-textarea"
          placeholder='e.g. "A huge queue is forming near Gate B and wheelchair users cannot move through the corridor."'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="sp-grid-2" style={{ marginTop: 8 }}>
          {CATEGORY_SHORTCUTS.map((c) => (
            <button
              key={c.label}
              type="button"
              className="sp-btn"
              style={{ minHeight: 38, fontSize: 13 }}
              onClick={() => setText(c.text)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sp-btn"
          style={{ marginTop: 8, width: '100%', fontSize: 13 }}
          onClick={() => setText(VOICE_SAMPLE)}
        >
          Use simulated voice transcript
        </button>

        <label htmlFor="vol-loc" className="sp-muted" style={{ marginTop: 10, display: 'block' }}>
          Location (optional — detected from text if omitted)
        </label>
        <select
          id="vol-loc"
          className="sp-select"
          value={locationHint}
          onChange={(e) => setLocationHint(e.target.value)}
        >
          <option value="">Detect from description</option>
          {LOCATION_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="sp-btn sp-btn-primary"
          style={{ marginTop: 10, width: '100%' }}
          disabled={!text.trim() || analyzing}
          onClick={() => void analyze()}
        >
          {analyzing ? 'Analyzing…' : 'Analyze report'}
        </button>
      </section>

      {preview && (
        <section className="sp-card" aria-labelledby="preview-heading">
          <h3 id="preview-heading">
            Structured incident{' '}
            <span className={`sp-provenance sp-badge ${provenance === 'gemini' ? 'sp-badge-cyan' : 'sp-badge-muted'}`}>
              {provenance === 'gemini' ? 'Gemini' : 'rules fallback'}
            </span>
          </h3>
          <ul className="sp-list">
            <li>
              Category: <strong>{preview.category.replace(/_/g, ' ')}</strong>{' '}
              <span className={`sp-badge ${preview.severity === 'critical' || preview.severity === 'high' ? 'sp-badge-urgent' : 'sp-badge-caution'}`}>
                {preview.severity}
              </span>
            </li>
            <li>Location: <strong>{nodeLabel(preview.locationId)}</strong></li>
            <li>People affected (est.): {preview.peopleAffectedEstimate}</li>
            <li>
              Accessibility impact:{' '}
              <span className={`sp-badge ${IMPACT_BADGE[preview.accessibilityImpact] ?? 'sp-badge-muted'}`}>
                {preview.accessibilityImpact}
              </span>
            </li>
            <li>Recommended team: <strong>{preview.recommendedTeam}</strong></li>
            <li>
              Recommended actions:
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {preview.recommendedActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </li>
            <li>Confidence: {(preview.confidence * 100).toFixed(0)}%</li>
            {preview.missingInformation.length > 0 && (
              <li className="sp-muted">
                Missing: {preview.missingInformation.join('; ')}
              </li>
            )}
            {preview.requiresHumanApproval && (
              <li>
                <span className="sp-badge sp-badge-caution">operator review required</span>
              </li>
            )}
          </ul>

          {duplicate && (
            <p role="alert" style={{ color: 'var(--sp-caution)' }}>
              A matching incident at this location is already in the queue.
              Duplicate submission is blocked — operations has this covered.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="sp-btn sp-btn-primary"
              style={{ flex: 1 }}
              disabled={duplicate}
              onClick={confirm}
            >
              Confirm &amp; submit
            </button>
            <button type="button" className="sp-btn" onClick={() => setPreview(null)}>
              Discard
            </button>
          </div>
        </section>
      )}

      {submittedId && (
        <section className="sp-card" role="status" style={{ borderColor: 'var(--sp-healthy)' }}>
          <h3>Report submitted</h3>
          <p>
            Incident <strong>{submittedId}</strong> is now in the operations
            queue. You will see its marker appear on the stadium map.
          </p>
        </section>
      )}

      <section className="sp-card" aria-labelledby="myreports-heading">
        <h3 id="myreports-heading">Recent volunteer reports</h3>
        {incidents.filter((i) => i.reportedBy === 'volunteer').length === 0 ? (
          <p className="sp-muted">No volunteer reports yet.</p>
        ) : (
          <ul className="sp-list">
            {incidents
              .filter((i) => i.reportedBy === 'volunteer')
              .slice(-5)
              .reverse()
              .map((i) => (
                <li key={i.id}>
                  <strong>{i.id}</strong> · {nodeLabel(i.locationId)} ·{' '}
                  <span className="sp-badge sp-badge-muted">{i.status.replace(/_/g, ' ')}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </>
  );
}
