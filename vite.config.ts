/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { aiError, tasksForEndpoint } from './src/ai/endpoints';
import type { AiTaskKind } from './src/ai/schemas';

/**
 * Dev-only bridge that serves the same Gemini serverless logic locally at
 * /api/gemini/*. In production, Vercel serves api/gemini/*.ts instead.
 * The API key stays in process.env on the dev server — never in the bundle.
 */
function geminiDevApi(mode: string): Plugin {
  return {
    name: 'stadiumpulse-gemini-dev-api',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '');
      for (const key of [
        'GEMINI_API_KEY',
        'GEMINI_MODEL',
        'GOOGLE_GENAI_USE_VERTEXAI',
        'GOOGLE_CLOUD_PROJECT',
        'GOOGLE_CLOUD_LOCATION',
      ]) {
        if (env[key] && !process.env[key]) {
          process.env[key] = env[key];
        }
      }
      server.middlewares.use('/api/gemini', (req, res) => {
        void (async () => {
          const endpoint = (req.url ?? '').replace(/^\//, '').split('?')[0] ?? '';
          const allowed = tasksForEndpoint(endpoint);
          const send = (status: number, body: unknown): void => {
            res.statusCode = status;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(body));
          };
          if (!allowed || req.method !== 'POST') {
            send(404, aiError('Unknown AI endpoint'));
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
            send(400, aiError('Invalid JSON body'));
            return;
          }
          if (!parsed.task || !(allowed as readonly string[]).includes(parsed.task)) {
            send(400, aiError('Invalid task for this endpoint'));
            return;
          }
          const { runGeminiTask } = await import('./api/_lib/gemini-core');
          const result = await runGeminiTask({
            task: parsed.task as AiTaskKind,
            ...(typeof parsed.userText === 'string' ? { userText: parsed.userText } : {}),
            context: parsed.context,
          });
          send(result.ok ? 200 : result.status, result);
        })().catch((err: unknown) => {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(aiError(String(err))));
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
