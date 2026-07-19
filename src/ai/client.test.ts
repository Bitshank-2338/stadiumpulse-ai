import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiClient } from './client';
import { useStadiumStore } from '../store/stadium-store';
import { extractIncidentFallback } from '../domain/incident-extraction';

beforeEach(() => {
  useStadiumStore.setState({
    auditLog: [],
    aiStatus: { available: false, lastProvenance: null, lastLatencyMs: null, lastError: null },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ai client fallback behaviour', () => {
  it('falls back deterministically when the endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await aiClient.extractIncident(
      'Huge queue at Gate B, wheelchair users stuck',
      undefined,
      () => extractIncidentFallback('Huge queue at Gate B, wheelchair users stuck'),
    );
    expect(result.provenance).toBe('fallback');
    expect(result.data.category).toBe('crowd_congestion');
    const s = useStadiumStore.getState();
    expect(s.aiStatus.available).toBe(false);
    expect(s.aiStatus.lastError).toContain('network down');
    expect(s.auditLog.some((e) => e.action === 'ai_fallback_used')).toBe(true);
  });

  it('falls back when the server returns invalid data (never crashes)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: { garbage: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const result = await aiClient.extractIncident(
      'trash overflow at food court 2',
      undefined,
      () => extractIncidentFallback('trash overflow at food court 2'),
    );
    expect(result.provenance).toBe('fallback');
    expect(result.data.category).toBe('waste_overflow');
  });

  it('accepts valid gemini responses and records latency', async () => {
    const valid = extractIncidentFallback('Person collapsed in Section 114');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: valid, provenance: 'gemini' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const result = await aiClient.extractIncident('Person collapsed in Section 114', undefined, () => valid);
    expect(result.provenance).toBe('gemini');
    const s = useStadiumStore.getState();
    expect(s.aiStatus.available).toBe(true);
    expect(s.aiStatus.lastProvenance).toBe('gemini');
    expect(s.aiStatus.lastLatencyMs).toBeTypeOf('number');
  });
});
