// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StoreProvider, useStore } from './store';
import type { Data, Game } from './types';

const repository = vi.hoisted(() => ({ load: vi.fn(), saveGame: vi.fn(), createRivalry: vi.fn(), discardGame: vi.fn(), deleteGame: vi.fn(), deleteRivalry: vi.fn() }));
vi.mock('./supabase', () => ({ cloudConfigured: true, createCloudRepository: () => repository }));
const empty: Data = { rivalries: [], games: [] };
const game: Game = { id: 'game', rivalry_id: 'r', started_at: '2026-01-01T00:00:00Z', ended_at: null, revision: 1, goals: [] };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider>{children}</StoreProvider>;
beforeEach(() => { vi.resetAllMocks(); repository.load.mockResolvedValue(empty); });
afterEach(cleanup);

it('keeps the initial loading screen until a newer focus refresh settles', async () => {
  const first = deferred<Data>(), second = deferred<Data>();
  repository.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result } = renderHook(useStore, { wrapper });
  act(() => window.dispatchEvent(new Event('focus')));
  expect(repository.load).toHaveBeenCalledTimes(2);
  await act(async () => first.resolve(empty));
  expect(result.current.loading).toBe(true);
  await act(async () => second.resolve({ rivalries: [], games: [game] }));
  expect(result.current.loading).toBe(false);
  expect(result.current.games).toEqual([game]);
});

it('does not replace a saved game with an older in-flight refresh', async () => {
  const { result } = renderHook(useStore, { wrapper });
  await act(async () => {});
  const oldRead = deferred<Data>();
  repository.load.mockReturnValueOnce(oldRead.promise);
  let refresh!: Promise<void>;
  act(() => { refresh = result.current.refresh(); });
  repository.saveGame.mockResolvedValue(game);
  await act(async () => { await result.current.saveGame({ ...game, revision: 0 }); });
  await act(async () => { oldRead.resolve(empty); await refresh; });
  expect(result.current.games).toEqual([game]);
});

it('reloads committed state after a lost save response and preserves the error for review', async () => {
  const { result } = renderHook(useStore, { wrapper });
  await act(async () => {});
  repository.saveGame.mockRejectedValue(new Error('Connection interrupted'));
  repository.load.mockResolvedValue({ rivalries: [], games: [game] });
  await act(async () => { await expect(result.current.saveGame({ ...game, revision: 0 })).rejects.toThrow('Connection interrupted'); });
  expect(result.current.games).toEqual([game]);
  expect(result.current.error).toBe('Connection interrupted');
  expect(result.current.busy).toBe(false);
});

it('retains the last known state when both a write and its recovery read fail', async () => {
  repository.load.mockResolvedValueOnce({ rivalries: [], games: [game] });
  const { result } = renderHook(useStore, { wrapper });
  await act(async () => {});
  repository.saveGame.mockRejectedValue(new Error('Offline'));
  repository.load.mockRejectedValue(new Error('Still offline'));
  await act(async () => { await expect(result.current.saveGame(game)).rejects.toThrow('Offline'); });
  expect(result.current.games).toEqual([game]);
  expect(result.current.error).toBe('Offline');
});
