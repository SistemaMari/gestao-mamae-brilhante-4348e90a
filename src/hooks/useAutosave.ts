import { useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Options<T> {
  /** Current form values to watch */
  data: T;
  /** Async function that persists the data. Should throw on error. */
  onSave: (data: T) => Promise<void>;
  /** Debounce in ms (default 1500) */
  debounceMs?: number;
  /** When false, autosave is paused (e.g. preview, not-yet-valid form) */
  enabled?: boolean;
}

/**
 * Generic autosave hook.
 * Watches `data`, debounces changes, calls `onSave`, exposes status.
 * The first render does NOT trigger a save (avoids saving empty form on mount).
 */
export function useAutosave<T>({ data, onSave, debounceMs = 1500, enabled = true }: Options<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const firstRunRef = useRef(true);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<T | null>(null);

  const serialized = JSON.stringify(data);

  useEffect(() => {
    if (!enabled) return;
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    setStatus('dirty');
    const timer = setTimeout(async () => {
      if (inFlightRef.current) {
        pendingRef.current = data;
        return;
      }
      inFlightRef.current = true;
      setStatus('saving');
      try {
        await onSaveRef.current(data);
        setStatus('saved');
        setLastSavedAt(new Date());
      } catch (e) {
        console.error('[autosave] error', e);
        setStatus('error');
      } finally {
        inFlightRef.current = false;
        if (pendingRef.current !== null) {
          const next = pendingRef.current;
          pendingRef.current = null;
          // re-trigger
          setStatus('dirty');
          setTimeout(async () => {
            inFlightRef.current = true;
            setStatus('saving');
            try {
              await onSaveRef.current(next);
              setStatus('saved');
              setLastSavedAt(new Date());
            } catch (e) {
              console.error('[autosave] error', e);
              setStatus('error');
            } finally {
              inFlightRef.current = false;
            }
          }, 0);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled, debounceMs]);

  return { status, lastSavedAt };
}
