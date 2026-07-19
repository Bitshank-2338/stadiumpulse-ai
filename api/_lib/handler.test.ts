import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it } from 'vitest';
import { makeGeminiHandler } from './handler';

function responseRecorder() {
  let statusCode = 0;
  let body: unknown;
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(value: unknown) { body = value; return response; },
  } as unknown as VercelResponse;
  return { response, read: () => ({ statusCode, body }) };
}

describe('Gemini handler error contract', () => {
  it('returns the shared error body for unsupported methods', async () => {
    const recorder = responseRecorder();
    await makeGeminiHandler(['incident'])({ method: 'GET' } as VercelRequest, recorder.response);
    expect(recorder.read()).toEqual({ statusCode: 405, body: { ok: false, error: 'Method not allowed' } });
  });

  it('rejects tasks that do not belong to the endpoint', async () => {
    const recorder = responseRecorder();
    await makeGeminiHandler(['incident'])(
      { method: 'POST', body: { task: 'announcement' } } as VercelRequest,
      recorder.response,
    );
    expect(recorder.read()).toEqual({
      statusCode: 400,
      body: { ok: false, error: 'Invalid task for this endpoint' },
    });
  });
});
