import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the viewport width is below a specified breakpoint
 * Optimized with debouncing and matchMedia API for better performance
 * @param breakpoint - The width threshold in pixels (default: 640px for mobile)
 * @returns boolean indicating if current viewport is mobile
 */
export function useIsMobile(breakpoint: number = 640): boolean {
  // SSR-safe initial state
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined') return;

    // Use matchMedia API for better performance
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    
    // Initial check
    setIsMobile(mediaQuery.matches);

    // Debounced resize handler
    let timeoutId: NodeJS.Timeout;
    const debouncedHandler = (e: MediaQueryListEvent | MediaQueryList) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(e.matches);
      }, 150); // 150ms debounce delay
    };

    // Modern browsers support addEventListener on MediaQueryList
    // Fallback to deprecated addListener for older browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', debouncedHandler);
    } else {
      // @ts-ignore - For older browsers
      mediaQuery.addListener(debouncedHandler);
    }

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', debouncedHandler);
      } else {
        // @ts-ignore - For older browsers
        mediaQuery.removeListener(debouncedHandler);
      }
    };
  }, [breakpoint]);

  return isMobile;
}
