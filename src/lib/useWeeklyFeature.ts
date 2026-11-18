import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import { DEFAULT_WEEKLY_SETTINGS, weeklyFeature } from './weeklyFeature';

export function useWeeklyFeature() {
  const store = useStore();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const settings = store.weekly_settings ?? DEFAULT_WEEKLY_SETTINGS;
  const feature = useMemo(() => weeklyFeature(store.games, store.rivalries, settings, now), [store.games, store.rivalries, settings, now]);
  return { ...feature, settings, now, loading: store.loading };
}
