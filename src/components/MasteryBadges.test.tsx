// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MasteryBadges } from './MasteryBadges';
import { advanceMastery, emptyMastery, MASTERY } from '../lib/mastery';
import type { MasteryId } from '../lib/mastery';
import type { Game } from '../lib/types';
afterEach(cleanup);
it('keeps the full-width panel and compacts the other badges until it closes',()=>{
  render(<MemoryRouter><MasteryBadges progress={emptyMastery()}/></MemoryRouter>);
  expect(screen.getAllByRole('button')).toHaveLength(10);
  expect(screen.getAllByText(/Not earned/)).toHaveLength(10);
  expect(screen.queryByText(/Next badges/)).toBeNull();
  const goals=screen.getByRole('button',{name:/Goal scorer/});
  const wins=screen.getByRole('button',{name:/Winning proficiency/});
  fireEvent.click(goals);
  const grid=goals.closest('.mastery-grid');
  const panel=screen.getByRole('region',{name:/Goal scorer/});
  expect(panel.parentElement).toBe(grid);
  expect(wins.nextElementSibling).toBe(panel);
  expect(grid?.classList.contains('has-selection')).toBe(true);
  fireEvent.click(wins);
  expect(goals.getAttribute('aria-expanded')).toBe('false');
  expect(wins.getAttribute('aria-expanded')).toBe('true');
  expect(screen.queryByRole('region',{name:/Goal scorer/})).toBeNull();
  expect(screen.getByRole('region',{name:/Winning proficiency/})).toBeTruthy();
  fireEvent.click(wins);
  expect(wins.getAttribute('aria-expanded')).toBe('false');
  expect(grid?.classList.contains('has-selection')).toBe(false);
  expect(screen.getAllByRole('region')).toHaveLength(1); // the mastery section only
});
it('earns platinum at its threshold and links all four tiers to their crossing games',()=>{
  const progress=emptyMastery();
  const increments=Object.fromEntries(MASTERY.map(b=>[b.id,0])) as Record<MasteryId,number>;
  const game={id:'bronze',rivalry_id:'r',started_at:'2026-11-03T12:00:00Z',ended_at:'2026-11-03T12:05:00Z',revision:1,goals:[]} as Game;
  [50,50,150,249].forEach((goals,i)=>advanceMastery(progress,{...increments,goals},{...game,id:`g${i}`}));
  expect(progress.goals.earned).toHaveLength(3);
  advanceMastery(progress,{...increments,goals:1},{...game,id:'platinum'});
  expect(progress.goals.earned.map(g=>g.id)).toEqual(['g0','g1','g2','platinum']);
  render(<MemoryRouter><MasteryBadges progress={progress}/></MemoryRouter>);
  const badge=screen.getByRole('button',{name:/Goal scorer Platinum/});
  expect(badge.className).toContain('tier-4');
  fireEvent.click(badge);
  const panel=screen.getByRole('region',{name:/Goal scorer Platinum/});
  expect(within(panel).getAllByRole('link')).toHaveLength(4);
  expect(within(panel).getByRole('link',{name:/Platinum/}).getAttribute('href')).toBe('/game/platinum');
});

it('earns purple Amethyst after Platinum at four times its requirement in every category',()=>{
 const progress=emptyMastery();
 const game={id:'before',rivalry_id:'r',started_at:'2026-11-03T12:00:00Z',ended_at:'2026-11-03T12:05:00Z',revision:1,goals:[]} as Game;
 const almost=Object.fromEntries(MASTERY.map(b=>[b.id,b.thresholds[4]-1])) as Record<MasteryId,number>;
 advanceMastery(progress,almost,game);
 for(const badge of MASTERY){
  expect(badge.thresholds[4]).toBe(badge.thresholds[3]*4);
  expect(progress[badge.id].earned).toHaveLength(4);
 }
 advanceMastery(progress,Object.fromEntries(MASTERY.map(b=>[b.id,1])) as Record<MasteryId,number>,{...game,id:'amethyst'});
 for(const badge of MASTERY)expect(progress[badge.id].earned[4].id).toBe('amethyst');
 render(<MemoryRouter><MasteryBadges progress={progress}/></MemoryRouter>);
 const badge=screen.getByRole('button',{name:/Goal scorer Amethyst/});
 expect(badge.className).toContain('tier-5');fireEvent.click(badge);
 const panel=screen.getByRole('region',{name:/Goal scorer Amethyst/});
 expect(within(panel).getAllByRole('link')).toHaveLength(5);
 expect(within(panel).getByRole('link',{name:/Amethyst/}).getAttribute('href')).toBe('/game/amethyst');
});
