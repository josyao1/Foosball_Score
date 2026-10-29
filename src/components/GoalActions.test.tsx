// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GoalActions } from './GoalActions';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('compact goal actions', () => {
 it('reveals full context and closes before editing or deleting the goal', () => {
  const edit = vi.fn(), remove = vi.fn();
  render(<GoalActions time="0:33" description="Josh and Brooks · middle rung · dunk" onEdit={edit} onRemove={remove}/>);
  const trigger = screen.getByRole('button', {name:'Goal actions at 0:33'});
  expect(screen.queryByRole('button', {name:'Edit goal at 0:33'})).toBeNull();
  fireEvent.click(trigger);
  expect(screen.getByText('Josh and Brooks · middle rung · dunk')).toBeTruthy();
  const editButton = screen.getByRole('button', {name:'Edit goal at 0:33'});
  expect(document.activeElement).toBe(editButton);
  fireEvent.click(editButton);
  expect(edit).toHaveBeenCalledTimes(1);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', {name:'Remove goal at 0:33'}));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('group')).toBeNull();
 });
 it('dismisses on Escape, outside press and resize; only exposes available actions', () => {
  render(<GoalActions time="0:33" description="Josh · goalie" onEdit={vi.fn()}/>);
  const trigger = screen.getByRole('button', {name:'Goal actions at 0:33'});
  fireEvent.click(trigger);
  expect(screen.queryByRole('button', {name:'Remove goal at 0:33'})).toBeNull();
  fireEvent.keyDown(document, {key:'Escape'});
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole('group')).toBeNull();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('group')).toBeNull();
  fireEvent.click(trigger);
  fireEvent(window, new Event('resize'));
  expect(screen.queryByRole('group')).toBeNull();
 });
 it('keeps touch actions available when the focused button blurs without a new focus target', () => {
  const remove = vi.fn();
  render(<GoalActions time="0:33" description="Josh · goalie" onEdit={vi.fn()} onRemove={remove}/>);
  fireEvent.click(screen.getByRole('button', {name:'Goal actions at 0:33'}));
  const edit = screen.getByRole('button', {name:'Edit goal at 0:33'});
  const removeButton = screen.getByRole('button', {name:'Remove goal at 0:33'});
  fireEvent.pointerDown(removeButton);
  fireEvent.blur(edit, {relatedTarget:null});
  expect(screen.getByRole('button', {name:'Remove goal at 0:33'})).toBe(removeButton);
  fireEvent.click(removeButton);
  expect(remove).toHaveBeenCalledOnce();
 });
 it('keeps the panel inside the horizontal viewport and flips above the bottom edge', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
   return (this.tagName === 'BUTTON'
    ? {left:2,right:34,top:window.innerHeight-44,bottom:window.innerHeight,width:32,height:44}
    : {left:0,right:190,top:0,bottom:150,width:190,height:150}) as DOMRect;
  });
  render(<GoalActions time="0:33" description="Josh · goalie" onEdit={vi.fn()} onRemove={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', {name:'Goal actions at 0:33'}));
  const panel = screen.getByRole('group');
  expect(panel.style.left).toBe('8px');
  expect(panel.style.top).toBe(`${window.innerHeight-44-150-4}px`);
 });
});
