/** Read the OS motion preference without assuming a browser environment. */
export function systemPrefersReducedMotion(
  matchMedia: ((query: string) => Pick<MediaQueryList, 'matches'>) | undefined =
    typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined,
): boolean {
  return matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
