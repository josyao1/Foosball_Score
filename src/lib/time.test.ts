import {it,expect} from 'vitest';
import {gameTime,gameDate} from './time';
it('uses California time across daylight saving and date boundaries',()=>{expect(gameTime('2026-01-02T07:30:00Z')).toBe('11:30 PM PST');expect(gameDate('2026-01-02T07:30:00Z')).toBe('Jan 1, 2026');expect(gameTime('2026-07-02T07:30:00Z')).toBe('12:30 AM PDT')});
