import { aiError, ENDPOINT_FOR, ENDPOINT_TASKS, tasksForEndpoint } from './endpoints';
import { TASK_SCHEMAS } from './schemas';

describe('AI endpoint contract', () => {
  it('maps every task to exactly one endpoint and back', () => {
    const tasks = Object.values(ENDPOINT_TASKS).flat();
    expect(tasks).toHaveLength(new Set(tasks).size);
    expect([...tasks].sort()).toEqual(Object.keys(TASK_SCHEMAS).sort());

    for (const task of tasks) {
      expect(tasksForEndpoint(ENDPOINT_FOR[task])).toContain(task);
    }
  });

  it('creates the shared typed error body', () => {
    expect(aiError('Invalid request')).toEqual({ ok: false, error: 'Invalid request' });
    expect(tasksForEndpoint('not-an-endpoint')).toBeUndefined();
  });
});
