// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { retireRecordPreview } from './retirePreview';
import { LocalRepository, STORAGE_KEY } from './storage';
const previewKey = 'table-talk-record-preview-v1';
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, '', '/'); });
it('removes only preview data and returns sample-game links to the real homepage', () => {
  localStorage.setItem(previewKey, '{samples}');
  sessionStorage.setItem(previewKey, 'on');
  localStorage.setItem(STORAGE_KEY, '{my-local-games}');
  localStorage.setItem('another-app', 'keep');
  sessionStorage.setItem('another-app', 'keep');
  window.history.replaceState({}, '', '/game/demo-burst?demo=records&record=burst#momentum');
  retireRecordPreview();
  expect(localStorage.getItem(previewKey)).toBeNull();
  expect(sessionStorage.getItem(previewKey)).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{my-local-games}');
  expect(localStorage.getItem('another-app')).toBe('keep');
  expect(sessionStorage.getItem('another-app')).toBe('keep');
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/');
});
it('preserves real routes, parameters and state, and safely runs more than once', () => {
  window.history.replaceState({ idx: 2 }, '', '/game/real-id?demo=records&record=run#momentum');
  retireRecordPreview();
  retireRecordPreview();
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/game/real-id?record=run#momentum');
  expect(window.history.state).toEqual({ idx: 2 });
});
it('keeps working when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  expect(retireRecordPreview).not.toThrow();
});
it('starts an unconfigured local table empty instead of generating sample games', async () => {
  expect(await new LocalRepository(localStorage).load()).toEqual({ rivalries: [], games: [] });
});
