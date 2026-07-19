import { systemPrefersReducedMotion } from './accessibility';

describe('systemPrefersReducedMotion', () => {
  it('uses the operating-system preference when available', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    expect(systemPrefersReducedMotion(matchMedia)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('defaults safely when matchMedia is unavailable', () => {
    expect(systemPrefersReducedMotion(undefined)).toBe(false);
  });
});
