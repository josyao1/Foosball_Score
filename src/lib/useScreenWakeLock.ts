import { useEffect, useState } from 'react';

export type WakeLockStatus = 'inactive' | 'unsupported' | 'off' | 'hidden' | 'requesting' | 'active' | 'released' | 'unavailable';

/** A lock belongs only to this visible live-game view, never to a background tab. */
export function useScreenWakeLock(active: boolean) {
  const [enabled, setEnabled] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<WakeLockStatus>('inactive');
  useEffect(() => {
    if (!active) { setStatus('inactive'); return; }
    if (window.isSecureContext === false || typeof navigator.wakeLock?.request !== 'function') {
      setStatus('unsupported'); return;
    }
    if (!enabled) { setStatus('off'); return; }
    let disposed = false, pageShown = true, generation = 0;
    let requesting: number | null = null;
    let held: WakeLockSentinel | null = null;
    const visible = () => pageShown && document.visibilityState === 'visible';
    const releaseSentinel = (lock: WakeLockSentinel) => { void lock.release().catch(() => { /* The browser may already have released it. */ }); };
    const release = () => {
      generation++;
      requesting = null;
      const lock = held;
      held = null;
      if (lock) releaseSentinel(lock);
    };
    async function acquire() {
      if (disposed || !visible() || held || requesting !== null) return;
      const token = ++generation;
      requesting = token;
      setStatus('requesting');
      try {
        const lock = await navigator.wakeLock.request('screen');
        // An old browser request can resolve after hide, navigation, toggle-off, or a newer request.
        if (disposed || token !== generation || !visible()) { releaseSentinel(lock); return; }
        if (lock.released) { setStatus('released'); return; }
        held = lock;
        lock.addEventListener('release', () => {
          if (disposed || held !== lock) return;
          held = null;
          setStatus(visible() ? 'released' : 'hidden');
        }, { once: true });
        setStatus('active');
      } catch {
        if (!disposed && token === generation) setStatus('unavailable');
      } finally {
        if (requesting === token) requesting = null;
      }
    }
    function visibilityChanged() {
      if (visible()) void acquire();
      else { release(); setStatus('hidden'); }
    }
    const pageHide = () => { pageShown = false; visibilityChanged(); };
    const pageShow = () => { pageShown = true; visibilityChanged(); };
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    visibilityChanged();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', pageShow);
      release();
    };
  }, [active, enabled, attempt]);
  return { status, enabled, setEnabled, retry: () => setAttempt(value => value + 1) };
}
