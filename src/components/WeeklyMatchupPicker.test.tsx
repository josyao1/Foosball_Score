// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WeeklyMatchupPicker } from './WeeklyMatchupPicker';
import type { weeklyFeature } from '../lib/weeklyFeature';

afterEach(cleanup);
const candidate: ReturnType<typeof weeklyFeature>['candidates'][number] = {
  rivalry:{id:'r',player_a:'Ada',player_b:'Bea',created_at:''},
  rating:42.7,count:8,close:6,winsA:4,winsB:4,averageIntensity:70,daysSincePlayed:9,cooldownPenalty:0,
};

it('selects a ranked matchup and allows returning to automatic recommendation',()=>{
  const onChange=vi.fn();
  const props={candidates:[candidate],selected:null,disabled:false,onChange};
  const view=render(<WeeklyMatchupPicker {...props}/>);
  expect((screen.getByRole('radio',{name:'Automatic recommendation'}) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('radio',{name:'Ada vs Bea'}));
  expect(onChange).toHaveBeenLastCalledWith('r');
  view.rerender(<WeeklyMatchupPicker {...props} selected="r"/>);
  expect((screen.getByRole('radio',{name:'Ada vs Bea'}) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText('6/8 close finishes · Last played 9 days ago')).toBeTruthy();
  fireEvent.click(screen.getByRole('radio',{name:'Automatic recommendation'}));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it('retains a saved pick outside the shortlist and disables the group while saving',()=>{
  const saved={...candidate.rivalry,id:'saved',player_a:'Chris'};
  render(<WeeklyMatchupPicker candidates={[candidate]} selected="saved" savedRivalry={saved} disabled onChange={vi.fn()}/>);
  expect((screen.getByRole('group',{name:'Matchup to play'}) as HTMLFieldSetElement).disabled).toBe(true);
  expect((screen.getByRole('radio',{name:/Chris vs Bea/}) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText('Current pick · outside these suggestions')).toBeTruthy();
});

it('offers automatic selection and an honest empty state without inventing candidates',()=>{
  render(<WeeklyMatchupPicker candidates={[]} selected={null} disabled={false} onChange={vi.fn()}/>);
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  expect(screen.getByText(/No eligible matchups yet/)).toBeTruthy();
  expect(screen.queryByRole('list')).toBeNull();
});
