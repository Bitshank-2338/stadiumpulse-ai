/**
 * Deterministic-ish id helpers. Original StadiumPulse AI code.
 * Uses a per-prefix counter plus a time component so ids are unique within a
 * session and stable enough for tests (counter can be reset).
 */

const counters = new Map<string, number>();

export function nextId(prefix: string): string {
  const n = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, n);
  return `${prefix}-${n.toString().padStart(4, '0')}`;
}

/** Test helper — resets all counters. */
export function resetIds(): void {
  counters.clear();
}
