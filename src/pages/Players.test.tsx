// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Players } from './Players';
import { selectProfile } from '../lib/profile';
import { App } from '../App';
import type { Game, Rivalry } from '../lib/types';
const fixture=vi.hoisted(()=>({games:[] as Game[],rivalries:[] as Rivalry[]}));
vi.mock('../lib/store',()=>({useStore:()=>({...fixture,cloud:true,loading:false,error:null})}));
const rivalry: Rivalry={id:'r',player_a:'Josh',player_b:'Brooks',created_at:'2026-01-01'};
const game: Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-03T18:00:00Z',ended_at:'2026-11-03T18:10:00Z',goals:Array.from({length:10},(_,i)=>({id:`g${i}`,actor_side:'a',rung:'goalie',flags:[],elapsed_ms:(i+1)*10000,occurred_at:'2026-11-03T18:00:00Z'}))};
afterEach(()=>{cleanup();vi.restoreAllMocks();fixture.games=[];fixture.rivalries=[];});
it('pins the selected player ahead of the wins ranking even when they have no wins',()=>{
  fixture.rivalries=[rivalry,{...rivalry,id:'second',player_a:'Andrew'}];
  fixture.games=[game,{...game,id:'g2'},{...game,id:'g3',rivalry_id:'second',started_at:'2026-11-04T18:00:00Z',ended_at:'2026-11-04T18:10:00Z'}];
  selectProfile('Brooks');
  try {
    render(<MemoryRouter><Players/></MemoryRouter>);
    expect(screen.getAllByRole('article').map(card=>within(card).getByRole('heading',{level:2}).textContent))
      .toEqual(['Brooks','Josh','Andrew']);
  } finally {
    cleanup();
    selectProfile(null);
  }
});
it('renders style, result and best-game links without a search box',()=>{
  fixture.games=[game]; fixture.rivalries=[rivalry];
  const {container}=render(<MemoryRouter><Players/></MemoryRouter>);
  const passport=screen.getByRole('article',{name:'Josh passport'});
  expect(passport.querySelector('.passport-winrate strong')?.textContent).toBe('100%');
  expect(within(passport).getByRole('link',{name:/Won 10–0 against Brooks/}).getAttribute('href')).toBe('/game/g');
  expect(within(passport).getByRole('link',{name:/Quickest win, 1:40/}).getAttribute('href')).toBe('/game/g');
  expect(passport.querySelector('.passport-rungs .passport-specialty')?.textContent).toBe('Goalie 100%');
  expect(passport.querySelector('.passport-finishes .passport-specialty')?.textContent).toBe('Not set yet');
  expect(within(passport).queryByText('Most played rivalry')).toBeNull();
  expect(container.querySelector('a a, a button')).toBeNull();
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(screen.getByRole('button',{name:'New player'})).toBeTruthy();
});
it('handles empty and unplayed profiles without made-up favorites or percentages',()=>{
  const view=render(<MemoryRouter><Players/></MemoryRouter>);
  expect(screen.getByText('No players yet')).toBeTruthy();
  fixture.rivalries=[rivalry];
  view.rerender(<MemoryRouter><Players/></MemoryRouter>);
  const passport=screen.getByRole('article',{name:'Josh passport'});
  expect(within(passport).getAllByText('Not set yet')).toHaveLength(2);
  expect(within(passport).getByText('No finished games')).toBeTruthy();
  expect(within(passport).queryByRole('link')).toBeNull();
});
it.each(['/players','/Players/'])('selects only the fourth tab at %s',path=>{
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
  const nav=screen.getByRole('navigation',{name:'Main navigation'});
  expect(within(nav).getAllByRole('link')).toHaveLength(4);
  expect(within(nav).getByRole('link',{name:'Players'}).getAttribute('aria-current')).toBe('page');
  expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1);
  fireEvent.click(within(nav).getByRole('link',{name:'Hall of Fame'}));
  expect(within(nav).getByRole('link',{name:'Players'}).hasAttribute('aria-current')).toBe(false);
});

it('shows own-goal frequency against all actor goals without showing regular as a finish',()=>{
  fixture.rivalries=[rivalry];
  fixture.games=[{...game,goals:game.goals.map((g,i)=>({...g,flags:i===0 ? ['own_goal'] : []}))}];
  render(<MemoryRouter><Players/></MemoryRouter>);
  const passport=screen.getByRole('article',{name:'Josh passport'});
  fireEvent.click(within(passport).getByRole('tab',{name:'Scoring'}));
  const finishes=within(passport).getByRole('region',{name:'Goal type profile'});
  expect(within(finishes).queryByText('Regular')).toBeNull();
  expect(within(finishes).getByText('10%')).toBeTruthy();
  expect(passport.querySelector('.passport-finishes .passport-specialty')?.textContent).toBe('Own goal');
});

it('links an earned mastery tier to the game that earned it and exposes its requirement',()=>{
  fixture.rivalries=[rivalry];fixture.games=[game];
  render(<MemoryRouter><Players/></MemoryRouter>);
  const passport=screen.getByRole('article',{name:'Josh passport'});
  fireEvent.click(within(passport).getByRole('tab',{name:/Badges/}));
  fireEvent.click(within(passport).getByRole('button',{name:/Goalie proficiency/}));
  const badge=within(passport).getByRole('region',{name:/Goalie proficiency/});
  expect(within(badge).getByText('10 goalie goals')).toBeTruthy();
  expect(within(badge).getByRole('link',{name:/Goalie proficiency: Bronze/}).getAttribute('href')).toBe('/game/g');
  expect(within(badge).getByText('15 to go')).toBeTruthy();
});

it('defaults to a short overview and switches every passport together by keyboard and tap',()=>{
 fixture.games=[game];fixture.rivalries=[rivalry];
 render(<MemoryRouter><Players/></MemoryRouter>);
 const josh=within(screen.getByRole('article',{name:'Josh passport'}));
 const brooks=within(screen.getByRole('article',{name:'Brooks passport'}));
 expect(josh.getByRole('tab',{name:'Overview'}).getAttribute('aria-selected')).toBe('true');
 expect(josh.queryByRole('region',{name:'IXL mastery badges'})).toBeNull();
 expect(josh.queryByRole('region',{name:'Rung profile'})).toBeNull();
 fireEvent.keyDown(josh.getByRole('tab',{name:'Overview'}),{key:'ArrowRight'});
 expect(josh.getByRole('region',{name:'Rung profile'})).toBeTruthy();
 expect(josh.queryByRole('region',{name:'Personal bests'})).toBeNull();
 expect(brooks.getByRole('region',{name:'Rung profile'})).toBeTruthy();
 expect(brooks.queryByRole('region',{name:'Personal bests'})).toBeNull();
 fireEvent.click(josh.getByRole('tab',{name:/Badges/}));
 expect(josh.getByRole('region',{name:'IXL mastery badges'})).toBeTruthy();
 expect(josh.queryByRole('region',{name:'Rung profile'})).toBeNull();
 expect(screen.getByRole('article',{name:'Josh passport'}).querySelector('.passport-winrate strong')?.textContent).toBe('100%');
 fireEvent.keyDown(josh.getByRole('tab',{name:/Badges/}),{key:'Home'});
 expect(josh.getByRole('region',{name:'Recent form'})).toBeTruthy();
 fireEvent.keyDown(josh.getByRole('tab',{name:'Overview'}),{key:'End'});
 expect(josh.getByRole('tab',{name:'Recent games'}).getAttribute('aria-selected')).toBe('true');
 fireEvent.keyDown(josh.getByRole('tab',{name:'Recent games'}),{key:'ArrowRight'});
 expect(josh.getByRole('tab',{name:'Overview'}).getAttribute('aria-selected')).toBe('true');
});

it('shows earned colored mastery highlights on Overview and opens the shared badges page',()=>{
 fixture.games=[game];fixture.rivalries=[rivalry];
 render(<MemoryRouter><Players/></MemoryRouter>);
 const passport=screen.getByRole('article',{name:'Josh passport'});
 const stamp=within(passport).getByRole('button',{name:'Bronze Goalie proficiency. View badges'});
 expect(stamp.className).toBe('medal-1');
 fireEvent.click(stamp);
 for(const card of screen.getAllByRole('article'))expect(within(card).getByRole('region',{name:'IXL mastery badges'})).toBeTruthy();
 expect(document.activeElement).toBe(within(passport).getByRole('tab',{name:/Badges/}));
});

it('keeps the viewport and selected player in place when a tab change causes a browser scroll adjustment',()=>{
 fixture.games=[game];fixture.rivalries=[rivalry];
 render(<MemoryRouter><Players/></MemoryRouter>);
 const passport=screen.getByRole('article',{name:'Josh passport'});
 const list=screen.getByRole('list',{name:'Players'});
 list.scrollLeft=320;
 // Model a browser layout adjustment between the click and the committed panel.
 const tabs=within(passport).getByRole('tablist');
 vi.spyOn(tabs,'getBoundingClientRect').mockReturnValueOnce({top:100} as DOMRect).mockReturnValue({top:700} as DOMRect);
 vi.spyOn(window,'scrollY','get').mockReturnValueOnce(600).mockReturnValue(0);
 vi.spyOn(window,'scrollX','get').mockReturnValue(0);
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 fireEvent.click(within(passport).getByRole('tab',{name:/Badges/}));
 expect(scroll).toHaveBeenCalledWith({left:0,top:600,behavior:'instant'});
 expect(list.scrollLeft).toBe(320);
 expect(within(passport).getByRole('region',{name:'IXL mastery badges'})).toBeTruthy();
});
it('anchors the clicked tab row when shorter panels move a later desktop row upward',()=>{
 fixture.games=[game];fixture.rivalries=[rivalry];
 render(<MemoryRouter><Players/></MemoryRouter>);
 const passport=screen.getByRole('article',{name:'Josh passport'});
 vi.spyOn(window,'scrollY','get').mockReturnValue(600);
 vi.spyOn(window,'scrollX','get').mockReturnValue(0);
 const tabs=within(passport).getByRole('tablist');
 vi.spyOn(tabs,'getBoundingClientRect').mockReturnValueOnce({top:100} as DOMRect).mockReturnValue({top:40} as DOMRect);
 const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 fireEvent.click(within(passport).getByRole('tab',{name:'Scoring'}));
 expect(scroll).toHaveBeenCalledWith({left:0,top:540,behavior:'instant'});
});
it('shows each player’s latest five finished games newest first in the fourth tab',()=>{
 fixture.rivalries=[rivalry];
 fixture.games=Array.from({length:7},(_,i)=>({...game,id:`recent-${i}`,started_at:new Date(Date.parse(game.started_at)+i*86400000).toISOString(),ended_at:new Date(Date.parse(game.ended_at!)+i*86400000).toISOString()}));
 fixture.games.push({...game,id:'live',ended_at:null});
 render(<MemoryRouter><Players/></MemoryRouter>);
 const josh=within(screen.getByRole('article',{name:'Josh passport'}));
 fireEvent.click(josh.getByRole('tab',{name:'Recent games'}));
 const rows=within(josh.getByRole('list',{name:'Recent games'})).getAllByRole('link');
 expect(rows.map(link=>link.getAttribute('href'))).toEqual(['6','5','4','3','2'].map(i=>`/game/recent-${i}`));
 expect(rows[0].textContent).toContain('Brooks');
 expect(rows[0].textContent).toContain('10:00');
 expect(josh.getAllByRole('tab')).toHaveLength(4);
 const brooks=within(screen.getByRole('article',{name:'Brooks passport'}));
 expect(within(brooks.getByRole('list',{name:'Recent games'})).getAllByRole('link')[0].textContent).toContain('Loss');
});
it('moves keyboard focus between tabs without requesting a scroll',()=>{
 fixture.games=[game];fixture.rivalries=[rivalry];
 render(<MemoryRouter><Players/></MemoryRouter>);
 const passport=screen.getByRole('article',{name:'Josh passport'});
 const scoring=within(passport).getByRole('tab',{name:'Scoring'});
 const focus=vi.spyOn(scoring,'focus');
 fireEvent.keyDown(within(passport).getByRole('tab',{name:'Overview'}),{key:'ArrowRight'});
 expect(focus).toHaveBeenCalledWith({preventScroll:true});
});

it('identifies each player’s teammate in recent team games and uses result balls',()=>{
 const player=(name:string)=>({id:name.toLowerCase(),name,created_at:'2026-01-01'});
 fixture.rivalries=[{...rivalry,player_a:'Josh and Brooks',player_b:'Andrew and Max',members:{a:[player('Josh'),player('Brooks')],b:[player('Andrew'),player('Max')]}}];
 fixture.games=[game];
 render(<MemoryRouter><Players/></MemoryRouter>);
 const josh=within(screen.getByRole('article',{name:'Josh passport'}));
 fireEvent.click(josh.getByRole('tab',{name:'Recent games'}));
 const row=josh.getByRole('list',{name:'Recent games'});
 expect(row.textContent).toContain('vs Andrew and Max');
 expect(row.textContent).toContain('with Brooks');
 expect(row.querySelector('.result-W .goal-ball')).toBeTruthy();
 const andrew=within(screen.getByRole('article',{name:'Andrew passport'})).getByRole('list',{name:'Recent games'});
 expect(andrew.textContent).toContain('with Max');
 expect(andrew.querySelector('.result-L .goal-ball')).toBeTruthy();
});
it('shows exactly one scouting note per scoring player only on Overview',()=>{
 fixture.games=[game];fixture.rivalries=[rivalry];
 render(<MemoryRouter><Players/></MemoryRouter>);
 const josh=within(screen.getByRole('article',{name:'Josh passport'}));
 expect(josh.getAllByRole('button',{name:/Scouting note/})).toHaveLength(1);
 expect(within(screen.getByRole('article',{name:'Brooks passport'})).queryByRole('button',{name:/Scouting note/})).toBeNull();
 fireEvent.click(josh.getByRole('tab',{name:'Scoring'}));
 expect(josh.queryByRole('button',{name:/Scouting note/})).toBeNull();
 fireEvent.click(josh.getByRole('tab',{name:'Overview'}));
 expect(josh.getAllByRole('button',{name:/Scouting note/})).toHaveLength(1);
});
