import { useEffect } from 'react';

/** Closes a modal/dialog on Escape, so keyboard users always have a way out. */
export function useEscapeKey(onClose: () => void, active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, active]);
}
