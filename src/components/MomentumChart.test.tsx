// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MomentumChart } from './MomentumChart';
import type { Game, Rivalry } from '../lib/types';
const rivalry:Rivalry={id:'r',player_a:'Black player with a very long full name',player_b:'White player with a very long full name',created_at:'2026-01-01T00:00:00Z'};
const game:Game={id:'g',rivalry_id:'r',started_at:'2026-01-01T00:00:00Z',ended_at:'2026-01-01T00:01:00Z',revision:1,goals:[{id:'one',actor_side:'a',rung:'defender',flags:[],elapsed_ms:1250,occurred_at:'2026-01-01T00:00:01.250Z'},{id:'two',actor_side:'a',rung:'goalie',flags:['own_goal'],elapsed_ms:40000,occurred_at:'2026-01-01T00:00:40Z'}]};
afterEach(cleanup);
describe('new game presentation behavior',()=>{
 it('shows own-goal credit, exact timing and keyboard selection in goal order',()=>{
  const {container}=render(<MomentumChart game={game} rivalry={rivalry}/>);
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('0:40.000');
  expect(container.querySelector('.momentum-selection')?.textContent).toContain(`${rivalry.player_b} scores · own goal by ${rivalry.player_a}`);
  fireEvent.click(screen.getByRole('button',{name:'Previous goal'}));
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('0:01.250');
  const point=screen.getByRole('button',{name:/Goal 1,/});
  fireEvent.keyDown(point,{key:'ArrowRight'});
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('0:40.000');
  expect(container.querySelector('.momentum-selection-meta strong')?.textContent).toBe('1 – 1');
 });
 it('handles a selected goal being removed and then an empty game',()=>{
  const {container,rerender}=render(<MomentumChart game={game} rivalry={rivalry}/>);
  fireEvent.click(screen.getByRole('button',{name:'Previous goal'}));
  rerender(<MomentumChart game={{...game,goals:[game.goals[1]]}} rivalry={rivalry}/>);
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('Goal 1 of 1');
  rerender(<MomentumChart game={{...game,goals:[]}} rivalry={rivalry}/>);
  expect(screen.getByText('The first goal will start the momentum chart.')).toBeTruthy();
  expect(container.querySelector('svg')).toBeNull();
 });
});
