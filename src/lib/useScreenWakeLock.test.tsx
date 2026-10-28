// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useScreenWakeLock } from './useScreenWakeLock';
class Lock extends EventTarget {
  released = false;
  release = vi.fn(async () => { this.released = true; this.dispatchEvent(new Event('release')); });
}
const request = vi.fn();
let visibility: DocumentVisibilityState = 'visible';
const flush = async () => { await act(async () => {}); };
async function hide(state: DocumentVisibilityState) {
  await act(async () => { visibility = state; document.dispatchEvent(new Event('visibilitychange')); });
}
beforeEach(() => {
  request.mockReset(); visibility = 'visible';
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.stubGlobal('isSecureContext', true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('acquires only for a live game and releases on finish', async () => {
  const lock = new Lock(); request.mockResolvedValue(lock);
  const view = renderHook(({ live }) => useScreenWakeLock(live), { initialProps: { live: false } });
  await flush(); expect(request).not.toHaveBeenCalled();
  view.rerender({ live: true }); await flush();
  expect(request).toHaveBeenCalledExactlyOnceWith('screen');
  expect(view.result.current.status).toBe('active');
  view.rerender({ live: false }); await flush();
  expect(lock.release).toHaveBeenCalledOnce();
  expect(view.result.current.status).toBe('inactive');
});
it('releases when hidden and reacquires when the tab becomes visible', async () => {
  const first = new Lock(), second = new Lock(); request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const { result } = renderHook(() => useScreenWakeLock(true)); await flush();
  await hide('hidden'); expect(first.release).toHaveBeenCalledOnce(); expect(result.current.status).toBe('hidden');
  await hide('visible'); expect(result.current.status).toBe('active'); expect(request).toHaveBeenCalledTimes(2);
});
it('releases on pagehide and reacquires on pageshow even if visibility did not change', async () => {
  const first = new Lock(), second = new Lock(); request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const { result } = renderHook(() => useScreenWakeLock(true)); await flush();
  await act(async () => window.dispatchEvent(new Event('pagehide')));
  expect(first.release).toHaveBeenCalledOnce(); expect(result.current.status).toBe('hidden');
  await act(async () => window.dispatchEvent(new Event('pageshow')));
  expect(request).toHaveBeenCalledTimes(2); expect(result.current.status).toBe('active');
});
it('keeps off through hide/show until enabled again', async () => {
  const first = new Lock(), second = new Lock(); request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const { result, unmount } = renderHook(() => useScreenWakeLock(true)); await flush();
  act(() => result.current.setEnabled(false)); await flush();
  expect(first.release).toHaveBeenCalledOnce(); expect(result.current.status).toBe('off');
  await hide('hidden'); await hide('visible'); expect(request).toHaveBeenCalledTimes(1);
  act(() => result.current.setEnabled(true)); await flush();
  expect(request).toHaveBeenCalledTimes(2);
  unmount(); expect(second.release).toHaveBeenCalledOnce();
});
it.each(['hidden', 'unmount', 'off', 'finish'])('releases a late grant after %s without claiming the screen is awake', async mode => {
  let grant!: (lock: Lock) => void;
  request.mockImplementation(() => new Promise<Lock>(resolve => { grant = resolve; }));
  const lock = new Lock();
  const view = renderHook(({ live }) => useScreenWakeLock(live), { initialProps: { live: true } });
  if (mode === 'hidden') await hide('hidden');
  if (mode === 'unmount') view.unmount();
  if (mode === 'off') act(() => view.result.current.setEnabled(false));
  if (mode === 'finish') view.rerender({ live: false });
  await act(async () => grant(lock));
  expect(lock.release).toHaveBeenCalledOnce();
  expect(view.result.current.status).not.toBe('active');
});
it('ignores out-of-order grants after rapid tab switching', async () => {
  const grants: ((lock: Lock) => void)[] = [];
  request.mockImplementation(() => new Promise<Lock>(resolve => grants.push(resolve)));
  const old = new Lock(), current = new Lock();
  const { result } = renderHook(() => useScreenWakeLock(true));
  await hide('hidden'); await hide('visible');
  await act(async () => grants[1](current));
  await act(async () => grants[0](old));
  expect(old.release).toHaveBeenCalledOnce(); expect(current.release).not.toHaveBeenCalled();
  expect(result.current.status).toBe('active');
});
it('reports platform release and rejection honestly and lets the user retry', async () => {
  const first = new Lock(), second = new Lock();
  request.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('Low battery')).mockResolvedValueOnce(second);
  const { result } = renderHook(() => useScreenWakeLock(true)); await flush();
  await act(async () => first.release());
  expect(result.current.status).toBe('released'); expect(request).toHaveBeenCalledTimes(1);
  act(() => result.current.retry()); await flush();
  expect(result.current.status).toBe('unavailable');
  act(() => result.current.retry()); await flush();
  expect(result.current.status).toBe('active');
});
it('does not request on hidden, unsupported, or insecure pages', async () => {
  visibility = 'hidden';
  const view = renderHook(() => useScreenWakeLock(true)); await flush();
  expect(request).not.toHaveBeenCalled(); expect(view.result.current.status).toBe('hidden'); view.unmount();
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
  const unsupported = renderHook(() => useScreenWakeLock(true)); await flush();
  expect(unsupported.result.current.status).toBe('unsupported'); unsupported.unmount();
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  visibility = 'visible'; vi.stubGlobal('isSecureContext', false);
  const insecure = renderHook(() => useScreenWakeLock(true)); await flush();
  expect(insecure.result.current.status).toBe('unsupported'); expect(request).not.toHaveBeenCalled();
});
it('cleans up the abandoned StrictMode request and holds only the current grant', async () => {
  const locks: Lock[] = [];
  request.mockImplementation(async () => { const lock = new Lock(); locks.push(lock); return lock; });
  const { result, unmount } = renderHook(() => useScreenWakeLock(true), { wrapper: StrictMode }); await flush();
  expect(locks).toHaveLength(2); expect(locks[0].release).toHaveBeenCalledOnce(); expect(locks[1].release).not.toHaveBeenCalled();
  expect(result.current.status).toBe('active');
  unmount(); expect(locks[1].release).toHaveBeenCalledOnce();
});
