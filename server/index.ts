/**
 * StadiumPulse AI — Cloud Run production server.
 * Original StadiumPulse AI code.
 *
 * Serves the built SPA from dist/ and mounts the same server-side Gemini core
 * used by the Vercel functions and the Vite dev bridge at /api/gemini/*.
 * On Cloud Run, Vertex AI credentials come from the attached service account
 * via Application Default Credentials — no keys in the image or env.
 */

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGeminiTask } from '../api/_lib/gemini-core';

const PORT = Number(process.env['PORT'] ?? 8080);
const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const MAX_BODY_BYTES = 64 * 1024;

/** Mirrors vite.config.ts geminiDevApi and api/gemini/*.ts task allowlists. */
const ENDPOINT_TASKS: Record<string, readonly string[]> = {
  incident: ['incident'],
  'fan-guidance': ['fan-intent', 'route-explanation', 'accessibility-explanation'],
  'situation-brief': ['situation-brief'],
  announcement: ['announcement', 'transport-advisory', 'sustainability-recommendation'],
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleGemini(
  req: IncomingMessage,
  res: ServerResponse,
  endpoint: string,
): Promise<void> {
  const allowed = ENDPOINT_TASKS[endpoint];
  if (!allowed || req.method !== 'POST') {
    sendJson(res, 404, { ok: false, error: 'Unknown AI endpoint' });
    return;
  }
  let parsed: { task?: string; userText?: string; context?: unknown };
  try {
    parsed = JSON.parse((await readBody(req)) || '{}') as typeof parsed;
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
    return;
  }
  if (typeof parsed.task !== 'string' || !allowed.includes(parsed.task)) {
    sendJson(res, 400, { ok: false, error: 'Invalid task for this endpoint' });
    return;
  }
  const result = await runGeminiTask({
    task: parsed.task as Parameters<typeof runGeminiTask>[0]['task'],
    ...(typeof parsed.userText === 'string' ? { userText: parsed.userText } : {}),
    context: parsed.context,
  });
  sendJson(res, result.ok ? 200 : result.status, result);
}

async function serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
  const safe = normalize(urlPath).replace(/^([.][.][/\\])+/, '');
  let filePath = join(DIST, safe === '/' || safe === '\\' ? 'index.html' : safe);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // SPA fallback: unknown paths get the app shell.
    filePath = join(DIST, 'index.html');
  }
  try {
    const data = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    const cache = filePath.includes('assets')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';
    res.writeHead(200, { 'content-type': type, 'cache-control': cache });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/healthz') {
      sendJson(res, 200, { ok: true });
      return;
    }
    const apiMatch = /^\/api\/gemini\/([a-z-]+)$/.exec(url.pathname);
    if (apiMatch?.[1]) {
      await handleGemini(req, res, apiMatch[1]);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }
    await serveStatic(res, url.pathname);
  })().catch((err: unknown) => {
    sendJson(res, 500, { ok: false, error: String(err) });
  });
});

server.listen(PORT, () => {
  console.log(`StadiumPulse AI serving on :${PORT} (dist: ${DIST})`);
});
