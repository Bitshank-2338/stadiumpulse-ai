// @vitest-environment node
/**
 * Live Gemini smoke test — only runs when GEMINI_LIVE=1 is set.
 * Verifies the real key, model availability and the schema pipeline.
 * Run: GEMINI_LIVE=1 npx vitest run api/_lib/live.test.ts
 */
import { describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';
import { runGeminiTask } from './gemini-core';

const LIVE = process.env['GEMINI_LIVE'] === '1';

describe.skipIf(!LIVE)('live gemini smoke', () => {
  it('extracts a structured incident from the reference example', async () => {
    const env = loadEnv('development', process.cwd(), '');
    for (const key of [
      'GEMINI_API_KEY',
      'GEMINI_MODEL',
      'GOOGLE_GENAI_USE_VERTEXAI',
      'GOOGLE_CLOUD_PROJECT',
      'GOOGLE_CLOUD_LOCATION',
    ]) {
      if (env[key]) process.env[key] = env[key];
    }

    const result = await runGeminiTask({
      task: 'incident',
      userText:
        'A huge queue is forming near Gate B and wheelchair users cannot move through the corridor.',
      context: {},
    });
    console.log('LIVE RESULT:', JSON.stringify(result, null, 2));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provenance).toBe('gemini');
      const data = result.data as { category: string; locationId: string };
      expect(['crowd_congestion', 'accessibility_outage']).toContain(data.category);
    }
  }, 45_000);
});
