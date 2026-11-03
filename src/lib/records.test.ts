import { describe, expect, it } from 'vitest';
import { gameHighlights, recordBook, momentScore, momentWindow, recordValue } from './records';
import type { Game } from './types';
const make = (seq: string, times = [...seq].map((_, i) => (i + 1) * 10000)): Game => ({
  id: 'game', rivalry_id: 'r', revision: 1, started_at: '2026-10-01T00:00:00Z', ended_at: '2026-10-01T01:00:00Z',
  goals: [...seq].map((s, i) => ({ id: `goal-${String(i).padStart(3, '0')}`, actor_side: s as 'a' | 'b', rung: 'attacker', flags: [], elapsed_ms: times[i], occurred_at: new Date(Date.parse('2026-10-01T00:00:00Z') + times[i]).toISOString() })),
});
describe('record book', () => {
  it('uses rolling inclusive 30s windows across opponent goals and ignores input order', () => {
    const g = make('aabaa', [12000, 20000, 25000, 35000, 42000]);
    g.goals.reverse();
    expect(gameHighlights(g).moments.burst).toMatchObject({ value: 4, start: 0, end: 4, side: 'a' });
    expect(gameHighlights(g).moments.triple?.value).toBe(22000);
  });
  it('records a one-point burst in slow games rather than leaving it unset', () => {
    expect(gameHighlights(make('aba', [1000, 41000, 81000])).moments.burst).toMatchObject({ value: 1, side: 'a' });
  });
  it('credits own goals to the opponent for runs but not all-rung achievements', () => {
    const g = make('aaaab');
    g.goals[3].flags = ['own_goal'];
    g.goals[3].rung = 'goalie';
    expect(gameHighlights(g).moments.run).toMatchObject({ value: 3, side: 'a' });
    expect(gameHighlights(g).allRungs).toEqual([]);
  });
  it('stops timing at the final goal and excludes early, live and continued-after-win games from quickest win', () => {
    expect(gameHighlights(make('aaaaaaaaaa')).moments.quickest?.value).toBe(100000);
    for (const g of [make('aaaa'), { ...make('aaaaaaaaaa'), ended_at: null }, make('aaaaaaaaaaa'), make('ab'.repeat(9) + 'a')]) {
      expect(gameHighlights(g).moments.quickest).toBeUndefined();
      expect(gameHighlights(g).moments.longest).toBeUndefined();
    }
    expect(gameHighlights(make('ababababababababababaa')).moments.quickest).toBeDefined();
  });
  it('ranks longest wins by the final goal, opposite to quickest wins, ignoring finish-button delays', () => {
    const fast = make('aaaaaaaaaa');
    const slow = {...make('bbbbbbbbbb', Array.from({length:10}, (_,i)=>(i+1)*20000)), id:'slow'};
    const book = recordBook([fast, slow]).book;
    expect(book.quickest?.game.id).toBe('game');
    expect(book.longest).toMatchObject({game:{id:'slow'},moment:{value:200000,side:'b'}});
    expect(recordValue(book.longest!.moment)).toBe('3:20.0');
    expect(momentWindow(slow, book.longest!.moment)).toEqual({startMs:0,endMs:200000});
  });
  it('measures droughts across both players and ignores time after the final goal', () => {
    const g = make('abba', [10000, 20000, 120000, 130000]);
    const moment = gameHighlights(g).moments.drought!;
    expect(moment).toMatchObject({value:100000,side:null,start:1,end:2});
    expect(momentWindow(g,moment)).toEqual({startMs:20000,endMs:120000});
    expect(momentScore(g,moment)).toBe('1–1 throughout');
    expect(recordValue(moment)).toBe('1:40.0');
    expect(recordBook([{...g,ended_at:null}]).book.drought).toBeUndefined();
  });
  it('includes kickoff droughts, handles zero-time goals and breaks equal records stably', () => {
    const g = make('ab', [60000, 61000]);
    const moment = gameHighlights(g).moments.drought!;
    expect(momentWindow(g,moment)).toEqual({startMs:0,endMs:60000});
    expect(momentScore(g,moment)).toBe('0–0 throughout');
    expect(gameHighlights(make('ab',[0,0])).moments.drought).toBeUndefined();
    expect(recordBook([{...g,id:'z'},g]).book.drought).toMatchObject({game:{id:'game'},ties:1});
  });
  it('does not count ties as lead changes and integrates time ahead through final goal', () => {
    const h = gameHighlights(make('abba', [10000, 20000, 30000, 40000]));
    expect(h.leadChanges).toBe(1);
    expect(h.timeAhead).toEqual({ a: 10000, b: 10000, tied: 20000 });
    expect(h.totalMs).toBe(40000);
    expect(h.moments.response).toMatchObject({ value: 10000, side: 'b' });
  });
  it('tracks the eventual winner’s biggest deficit, not the loser’s', () => {
    const h = gameHighlights(make('bbbbaaaaaaaaaa'));
    expect(h.moments.comeback).toMatchObject({ side: 'a', value: 4 });
  });
  it('handles zero-time goals and empty games without NaN or missing ties', () => {
    expect(gameHighlights(make('aaa', [0, 0, 0])).moments.triple?.value).toBe(0);
    expect(gameHighlights(make('')).totalMs).toBe(0);
    expect(recordBook([]).book).toEqual({});
  });
  it('keeps tied records stable and recalculates after edits/deletions; never counts live games', () => {
    const a = make('aaaa'), b = { ...make('bbbb'), id: 'z' }, live = { ...make('aaaaaaaaaa'), ended_at: null };
    expect(recordBook([live, b, a]).book.run).toMatchObject({ game: { id: 'game' }, ties: 1 });
    expect(recordBook([b]).book.run?.moment.side).toBe('b');
    a.goals.pop();
    expect(recordBook([a, b]).book.run?.game.id).toBe('z');
  });
  it('reports denominators for comeback, opener and deuce win rates', () => {
    const result = recordBook([make('bbbaaaaaaaaaa'), { ...make('ababababababababababbb'), id: 'deuce' }]);
    expect(result.rates.a.comeback).toEqual([1, 1]);
    expect(result.rates.a.clutch).toEqual([0, 1]);
    expect(result.rates.b.opener).toEqual([0, 1]);
  });
});

describe('comeback tiebreakers', () => {
  const early = {...make('abbbbb' + 'a'.repeat(9)),id:'early'}; // 1–5 -> 10–5
  const late = {...make('ab'.repeat(5) + 'bbbb' + 'a'.repeat(6)),id:'late'}; // 5–9 -> 11–9
  it('prefers the equal deficit reached later in the score, regardless of game order or elapsed time', () => {
    const slowEarly = {...early,goals:early.goals.map(g=>({...g,elapsed_ms:g.elapsed_ms*10}))};
    for (const games of [[slowEarly,late],[late,slowEarly]]) {
      expect(recordBook(games).book.comeback).toMatchObject({game:{id:'late'},moment:{value:4,start:13},ties:0});
    }
  });
  it('uses the latest occurrence of the maximum deficit within one game for the linked moment', () => {
    const g=make('abbbbb' + 'ab'.repeat(4) + 'a'.repeat(6));
    const moment=gameHighlights(g).moments.comeback!;
    expect(moment).toMatchObject({value:4,start:13});
    expect(momentScore(g,moment)).toBe('5–9 → 11–9');
  });
  it('keeps a bigger deficit ahead of a later smaller one', () => {
    const larger={...make('bbbbb' + 'a'.repeat(10)),id:'larger'};
    expect(recordBook([late,larger]).book.comeback).toMatchObject({game:{id:'larger'},moment:{value:5}});
  });
  it('counts ties only when deficit and score stage match, keeping the earliest game', () => {
    const laterEqual={...late,id:'later-equal',started_at:'2026-10-02T00:00:00Z'};
    const result=recordBook([laterEqual,early,late]).book.comeback!;
    expect(result).toMatchObject({game:{id:'late'},ties:1});
    expect(recordBook([laterEqual,early]).book.comeback).toMatchObject({game:{id:'later-equal'},ties:0});
  });
  it('applies the same rule to the white side and opponent own goals', () => {
    const asWhite=(g:Game)=>({...g,goals:g.goals.map(goal=>({...goal,actor_side:goal.actor_side==='a'?'b' as const:'a' as const}))});
    const whiteLate=asWhite(late);
    whiteLate.goals[0]={...whiteLate.goals[0],actor_side:'a',flags:['own_goal']};
    expect(recordBook([asWhite(early),whiteLate]).book.comeback).toMatchObject({game:{id:'late'},moment:{side:'b',value:4,start:13}});
  });
});

describe('match-point win rate', () => {
  it('counts each game once, including a player who had match point but lost', () => {
    // 9–8 -> 9–9 -> 10–9 -> 10–10 -> 10–11 -> 10–12.
    const game=make('ab'.repeat(8)+'ababb b'.replaceAll(' ',''));
    const rates=recordBook([game]).rates;
    expect(rates.a.matchPoint).toEqual([0,1]);
    expect(rates.b.matchPoint).toEqual([1,1]);
  });
  it('requires the next goal to win by two and does not count already-won states', () => {
    expect(gameHighlights(make('ab'.repeat(9))).hadMatchPoint).toEqual({a:true,b:false}); // A was at 9–8 before 9–9.
    const tied=gameHighlights(make('ab'.repeat(8)+'ba')); // B was at 9–8; A never held match point.
    expect(tied.hadMatchPoint).toEqual({a:false,b:true});
    expect(gameHighlights(make('a'.repeat(8))).hadMatchPoint).toEqual({a:false,b:false});
    const won=gameHighlights(make('a'.repeat(10)+'b'.repeat(9)));
    expect(won.hadMatchPoint.b).toBe(false); // 10–9 is already won by A, not match point for B.
  });
  it('credits own goals correctly and excludes live games from the rate', () => {
    const own=make('a'.repeat(8)+'ba'); own.goals[8].flags=['own_goal']; // 9–0 -> 10–0.
    expect(recordBook([own]).rates.a.matchPoint).toEqual([1,1]);
    expect(recordBook([{...own,ended_at:null}]).rates.a.matchPoint).toEqual([0,0]);
  });
});
