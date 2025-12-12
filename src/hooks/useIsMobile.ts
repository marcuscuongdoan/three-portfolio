import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the viewport width is below a specified breakpoint
 * @param breakpoint - The width threshold in pixels (default: 640px for mobile)
 * @returns boolean indicating if current viewport is mobile
 */
export function useIsMobile(breakpoint: number = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // Initial check
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Check on mount
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [breakpoint]);

  return isMobile;
}
