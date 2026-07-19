/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev-only bridge that serves the same Gemini serverless logic locally at
 * /api/gemini/*. In production, Vercel serves api/gemini/*.ts instead.
 * The API key stays in process.env on the dev server — never in the bundle.
 */
function geminiDevApi(mode: string): Plugin {
  const ENDPOINT_TASKS: Record<string, string[]> = {
    incident: ['incident'],
    'fan-guidance': ['fan-intent', 'route-explanation', 'accessibility-explanation'],
    'situation-brief': ['situation-brief'],
    announcement: ['announcement', 'transport-advisory', 'sustainability-recommendation'],
  };
  return {
    name: 'stadiumpulse-gemini-dev-api',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '');
      if (env['GEMINI_API_KEY'] && !process.env['GEMINI_API_KEY']) {
        process.env['GEMINI_API_KEY'] = env['GEMINI_API_KEY'];
      }
      if (env['GEMINI_MODEL'] && !process.env['GEMINI_MODEL']) {
        process.env['GEMINI_MODEL'] = env['GEMINI_MODEL'];
      }
      server.middlewares.use('/api/gemini', (req, res) => {
        void (async () => {
          const endpoint = (req.url ?? '').replace(/^\//, '').split('?')[0] ?? '';
          const allowed = ENDPOINT_TASKS[endpoint];
          const send = (status: number, body: unknown): void => {
            res.statusCode = status;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(body));
          };
          if (!allowed || req.method !== 'POST') {
            send(404, { ok: false, error: 'Unknown AI endpoint' });
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          let parsed: { task?: string; userText?: string; context?: unknown };
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as typeof parsed;
          } catch {
            send(400, { ok: false, error: 'Invalid JSON body' });
            return;
          }
          if (!parsed.task || !allowed.includes(parsed.task)) {
            send(400, { ok: false, error: 'Invalid task for this endpoint' });
            return;
          }
          const { runGeminiTask } = await import('./api/_lib/gemini-core');
          const result = await runGeminiTask({
            task: parsed.task as Parameters<typeof runGeminiTask>[0]['task'],
            ...(typeof parsed.userText === 'string' ? { userText: parsed.userText } : {}),
            context: parsed.context,
          });
          send(result.ok ? 200 : result.status, result);
        })().catch((err: unknown) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), geminiDevApi(mode)],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  // Vitest reads the `test` key from vite config (types via the reference above)
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}));
