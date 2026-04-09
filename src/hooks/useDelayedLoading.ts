import { useState, useEffect } from 'react';

/**
 * Returns true only after `isLoading` has been true for `delayMs`
 * milliseconds. If loading resolves before the delay, the loading
 * state is never shown — preventing spinner flashes on fast
 * connections.
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 300): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [isLoading, delayMs]);

  return show;
}
