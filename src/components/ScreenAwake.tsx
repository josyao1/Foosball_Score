import { Sun, Moon } from 'lucide-react';
import { useScreenWakeLock } from '../lib/useScreenWakeLock';
import type { WakeLockStatus } from '../lib/useScreenWakeLock';
const labels: Record<WakeLockStatus, string> = {
  active: 'Screen awake', requesting: 'Keeping screen awake…', off: 'Normal screen timeout',
  hidden: 'Screen lock paused', released: 'Screen may sleep', unavailable: 'Screen may sleep',
  unsupported: 'Keep-awake unavailable', inactive: 'Normal screen timeout',
};
export function ScreenAwake() {
  const { status, enabled, setEnabled, retry } = useScreenWakeLock(true);
  const needsRetry = status === 'released' || status === 'unavailable';
  return <div className="screen-awake-control">
    <span className="screen-awake-status" role="status">
      {status === 'active' ? <Sun size={15} aria-hidden="true"/> : <Moon size={15} aria-hidden="true"/>}
      {labels[status]}
    </span>
    {status !== 'unsupported' && <button type="button" className="text-button" role="switch" aria-label="Keep screen awake" aria-checked={enabled} onClick={() => setEnabled(!enabled)}>{enabled ? 'Turn off' : 'Turn on'}</button>}
    {needsRetry && <button type="button" className="text-button" onClick={retry}>Try again</button>}
    {needsRetry && <small>Your phone released or declined the lock. Check Low Power Mode.</small>}
    {status === 'unsupported' && <small>Requires HTTPS and a supported browser.</small>}
  </div>;
}
