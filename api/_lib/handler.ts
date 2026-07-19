/**
 * StadiumPulse AI — shared Vercel handler factory.
 * Original StadiumPulse AI code.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runGeminiTask } from './gemini-core';
import type { AiTaskKind } from '../../src/ai/schemas';
import { aiError } from '../../src/ai/endpoints';

export function makeGeminiHandler(allowedTasks: readonly AiTaskKind[]) {
  return async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.status(405).json(aiError('Method not allowed'));
      return;
    }
    const body: unknown = req.body;
    const { task, userText, context } = (body ?? {}) as {
      task?: string;
      userText?: string;
      context?: unknown;
    };
    if (!task || !allowedTasks.includes(task as AiTaskKind)) {
      res.status(400).json(aiError('Invalid task for this endpoint'));
      return;
    }
    const result = await runGeminiTask({
      task: task as AiTaskKind,
      ...(typeof userText === 'string' ? { userText } : {}),
      context,
    });
    if (result.ok) {
      res.status(200).json(result);
    } else {
      res.status(result.status).json(result);
    }
  };
}
