import { describe, expect, it } from 'vitest';
import { scorigami } from './scorigami';
import { featuredSpecialGame, missingScores, scorigamiRecords } from './scorigamiDiscoveries';
import type { OddityRecord } from './scorigamiDiscoveries';
import type { Game, GoalFlag, Rung, Side } from './types';

function game(id: string, a = 10, b = 8, rivalry = 'r'): Game {
  return { id, rivalry_id: rivalry, revision: 1, started_at: '2026-11-01T18:00:00Z', ended_at: '2026-11-01T18:05:00Z',
    goals: Array.from({length: a + b}, (_, i) => ({ id: `${id}-${i}`, actor_side: (i < a ? 'a' : 'b') as Side,
      rung: 'attacker' as Rung, flags: [] as GoalFlag[], elapsed_ms: i * 1000, occurred_at: '2026-11-01T18:00:00Z' })) };
}
const record = (games: Game[], id: string) => scorigamiRecords(scorigami(games).completed).find(r => r.id === id)!;
function sequence(id:string,sides:string):Game {
  const g=game(id);
  g.goals=sides.split('').map((side,i)=>({...g.goals[0],id:`${id}-${i}`,actor_side:side as Side,elapsed_ms:(i+1)*10000}));
  return g;
}

describe('scorigami records', () => {
  it('records only a winning comeback and counts lead changes across ties', () => {
    const comeback=sequence('comeback','bbbbbb'+'aaaaaaaaaa');
    const leadChanges=sequence('lead-changes','abbaabba'+'aaaaaa');
    const unfinished={...comeback,id:'draw',goals:comeback.goals.slice(0,12)};
    expect(scorigamiRecords([comeback]).find(r=>r.id==='comeback')?.value).toBe(6);
    expect(scorigamiRecords([unfinished]).find(r=>r.id==='comeback')?.matches).toEqual([]);
    expect(scorigamiRecords([leadChanges]).find(r=>r.id==='leadChanges')?.value).toBe(4);
  });
  it('ranks fastest three goals by shortest elapsed time, including an intervening opponent goal', () => {
    const fast=sequence('fast-three','ababa'+'aaaaaaa');
    fast.goals.slice(0,5).forEach((g,i)=>{g.elapsed_ms=i*500;});
    const slow=sequence('slow-three','aaaaaaaaaa');
    const result=scorigamiRecords([fast,slow]).find(r=>r.id==='triple')!;
    expect(result.value).toBe(2000);
    expect(result.matches.map(m=>m.game.id)).toEqual(['fast-three']);
    const simultaneous={...slow,id:'simultaneous',goals:slow.goals.map(g=>({...g,elapsed_ms:0}))};
    expect(scorigamiRecords([fast,simultaneous]).find(r=>r.id==='triple')?.value).toBe(0);
    expect(scorigamiRecords([fast,simultaneous]).find(r=>r.id==='triple')?.matches).toHaveLength(1);
  });
  it('counts match points saved for the threatened side, including own-goal credits but not deuce', () => {
    const saved=sequence('saved','bbbbbbbbb'+'aaaaaaaaaaa');
    saved.goals[9].actor_side='b'; saved.goals[9].flags=['own_goal'];
    const result=scorigamiRecords([saved]).find(r=>r.id==='matchPoints')!;
    expect(result.value).toBe(9);
    expect(result.matches[0].savedSides).toEqual(['a']);
    const noThreat=sequence('no-threat','abababab'+'aaaaaa');
    expect(scorigamiRecords([noThreat]).find(r=>r.id==='matchPoints')?.matches).toEqual([]);
  });
  it('features the next highest-percentage tied special game when the first is already shown above', () => {
    const first={game:game('own-record',10,4),holders:[]};
    const second={game:game('second',10,8),holders:[]};
    const third={game:game('third',13,11),holders:[]};
    const records:OddityRecord[]=[
      {id:'ownGoals',value:5,matches:[first,second]},
      {id:'specials',value:8,matches:[first,second,third]},
    ];
    // Only the first match is displayed on each card; a hidden tie remains eligible.
    expect(featuredSpecialGame(records)?.game.id).toBe('second');
    expect(records[1].matches.map(m=>m.game.id)).toEqual(['own-record','second','third']);
    expect(records[1].value).toBe(8);
  });
  it('falls back to the highest percentage if every tied special game is already featured', () => {
    const first={game:game('first',10,4),holders:[]}, second={game:game('second',13,11),holders:[]};
    const records:OddityRecord[]=[
      {id:'ownGoals',value:5,matches:[first]},
      {id:'banks',value:6,matches:[second]},
      {id:'specials',value:8,matches:[first,second]},
    ];
    expect(featuredSpecialGame(records)?.game.id).toBe('first');
    expect(featuredSpecialGame([])).toBeUndefined();
  });
  it('features the highest special-goal percentage when counts tie, retaining all tied games', () => {
    const long = game('long',13,11), short = game('short',10,2), fewer = game('fewer',10,0);
    long.ended_at='2026-11-02T18:05:00Z';
    for (const g of [long,short,fewer]) g.goals.slice(0,g===fewer?7:8).forEach(goal=>{goal.flags=['bank'];});
    const result = record([long,short,fewer],'specials');
    expect(result.value).toBe(8);
    expect(result.matches.map(m=>m.game.id)).toEqual(['short','long']);
  });
  it('features the quickest equal-length run, even when it is the second tied run in a game', () => {
    const slow = game('slow'), fast = game('fast');
    for (const g of [slow,fast]) {
      g.goals = 'aaabbbabababababab'.split('').map((side,i)=>({...g.goals[0],id:`${g.id}-${i}`,actor_side:side as Side,elapsed_ms:i*10000}));
    }
    fast.goals[4].elapsed_ms=31000;
    fast.goals[5].elapsed_ms=32000;
    const result = scorigamiRecords([slow,fast]).find(r=>r.id==='run')!;
    expect(result.value).toBe(3);
    expect(result.matches.map(m=>m.game.id)).toEqual(['fast','slow']);
    expect(result.matches[0].run).toEqual({side:'b',durationMs:2000});
  });
  it('credits an own goal to the opposing run and sorts goals without mutating them', () => {
    const g = game('own');
    g.goals = g.goals.slice(0,4);
    g.goals[1].actor_side='b'; g.goals[1].flags=['own_goal'];
    g.goals[3].actor_side='b';
    g.goals.reverse();
    const before = g.goals.map(goal=>goal.id);
    const result=scorigamiRecords([g]).find(r=>r.id==='run')!;
    expect(result.value).toBe(3);
    expect(result.matches[0].run).toEqual({side:'a',durationMs:2000});
    expect(g.goals.map(goal=>goal.id)).toEqual(before);
  });
  it('sums both teams, counts combos in both categories but only once as special, and excludes own goals from rung records', () => {
    const g = game('mixed', 11, 7);
    g.goals[0].flags = ['own_goal', 'dunk', 'bank'];
    g.goals[1].flags = ['dunk', 'bank'];
    g.goals[12].flags = ['dunk'];
    expect(record([g], 'dunks').value).toBe(2);
    expect(record([g], 'banks').value).toBe(1);
    expect(record([g], 'ownGoals').value).toBe(1);
    expect(record([g], 'specials').value).toBe(3);
    expect(record([g], 'rung').value).toBe(10);
  });
  it('combines teammate goals before and after swaps without combining opposing sides', () => {
    const g = game('team');
    g.goals.forEach((goal, i) => { goal.lineup = { a: { attack: i < 5 ? 'josh' : 'brooks', defense: i < 5 ? 'brooks' : 'josh' }, b: { attack: 'andrew', defense: 'andrew' } }; });
    const r = record([g], 'rung');
    expect(r.value).toBe(10);
    expect(r.matches[0].holders).toEqual([{side:'a', rung:'attacker'}]);
  });
  it('counts a game once even when both teams tie its single-rung record', () => {
    const g = game('ties');
    g.goals[0].rung = g.goals[1].rung = 'goalie';
    const r = record([g], 'rung');
    expect(r.value).toBe(8);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].holders).toHaveLength(2);
  });
  it('replaces broken records, retains all ties, and recalculates after archive, restore, edit and filtering', () => {
    const old = game('old'), tied = game('tied'), next = game('new', 10, 8, 'other');
    old.goals[0].flags = tied.goals[0].flags = ['bank'];
    next.goals[0].flags = next.goals[1].flags = ['bank'];
    expect(record([old, tied], 'banks').matches).toHaveLength(2);
    expect(record([old, tied, next], 'banks').matches.map(m=>m.game.id)).toEqual(['new']);
    next.deleted_at = '2026-11-02T00:00:00Z';
    expect(record([old, tied, next], 'banks').value).toBe(1);
    next.deleted_at = null;
    expect(record([old, tied, next], 'banks').value).toBe(2);
    expect(scorigamiRecords(scorigami([old, tied, next], 'r').completed).find(r=>r.id==='banks')?.value).toBe(1);
    next.goals[1].flags = [];
    expect(record([old, tied, next], 'banks').matches).toHaveLength(3);
    expect(record([{...next, ended_at:null}], 'banks').value).toBe(0);
  });
});
it('shows missing regular finishes, overtime gaps and one new overtime target', () => {
  const data = scorigami([game('ten',10,8), game('long',13,11)]);
  const missing = missingScores(data.buckets, data.maxScore);
  expect(missing).toContainEqual({high:10,low:0});
  expect(missing).not.toContainEqual({high:10,low:8});
  expect(missing.filter(s=>s.high>10)).toEqual([{high:11,low:9},{high:12,low:10},{high:14,low:12}]);
  expect(missingScores(new Map(),10)).toHaveLength(10);
});
