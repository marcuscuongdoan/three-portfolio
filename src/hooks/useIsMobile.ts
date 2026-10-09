import { useCallback, useSyncExternalStore } from 'react';

/**
 * Custom hook to detect if the viewport width is below a specified breakpoint.
 * Uses matchMedia via useSyncExternalStore: SSR-safe (false on the server),
 * updates immediately after hydration, and only re-renders when the media
 * query actually flips (no resize debouncing needed).
 * @param breakpoint - The width threshold in pixels (default: 640px for mobile)
 * @returns boolean indicating if current viewport is mobile
 */
export function useIsMobile(breakpoint: number = 640): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // Server snapshot
  );
}
