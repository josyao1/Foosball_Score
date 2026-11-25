// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { activeAvailability, validateAvailability, useAvailabilityDate } from './playerAvailability';
import { LocalRepository } from './storage';
import { defaultAppearance } from './playerAppearance';
const out={status:'out' as const,reason:'On vacation',returnDate:'2026-12-01'};
afterEach(()=>{cleanup();vi.useRealTimers();});
it('expires on the return date in Pacific time, including daylight time',()=>{
 expect(activeAvailability(out,new Date('2026-12-01T07:59:59Z'))).toEqual(out);
 expect(activeAvailability(out,new Date('2026-12-01T08:00:00Z'))).toBeNull();
 expect(activeAvailability({...out,returnDate:'2026-07-01'},new Date('2026-07-01T06:59:59Z'))).not.toBeNull();
 expect(activeAvailability({...out,returnDate:'2026-07-01'},new Date('2026-07-01T07:00:00Z'))).toBeNull();
 expect(activeAvailability({...out,returnDate:''},new Date('2030-01-01'))).toBeTruthy();
 expect(activeAvailability(null)).toBeNull();
});
it('removes OUT on an open page and after a sleeping tab wakes',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-12-01T07:59:59Z'));
 const {result}=renderHook(()=>activeAvailability(out,useAvailabilityDate()));
 expect(result.current).not.toBeNull();
 act(()=>vi.advanceTimersByTime(1000));expect(result.current).toBeNull();
 vi.setSystemTime(new Date('2026-11-30T20:00:00Z'));
 act(()=>window.dispatchEvent(new Event('focus')));expect(result.current).not.toBeNull();
 vi.setSystemTime(new Date('2026-12-02T20:00:00Z'));
 act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(result.current).toBeNull();
});
it('validates dates and custom text, and clears available settings',()=>{
 expect(validateAvailability({...out,reason:'  OOO  '})).toEqual({...out,reason:'OOO'});
 expect(validateAvailability({status:'available',reason:'old',returnDate:''})).toBeNull();
 expect(()=>validateAvailability({...out,returnDate:'2026-02-30'})).toThrow(/date/i);
 expect(()=>validateAvailability({...out,reason:'a'.repeat(49)})).toThrow(/48/);
});
it('persists independently of appearance, rejects stale writes, and can be cleared',async()=>{
 let raw='';const storage={getItem:()=>raw||null,setItem:(_:string,s:string)=>{raw=s;}};
 const repo=new LocalRepository(storage);const player=await repo.createPlayer('josh');
 await repo.updateAvailability(player,out);
 const second=new LocalRepository(storage);const saved=(await second.load()).players![0];
 expect(saved.availability).toEqual(out);expect(saved.availability_revision).toBe(1);
 await repo.updatePlayer(player,{name:'Josh',appearance:defaultAppearance('josh')});
 expect((await second.load()).players![0].availability).toEqual(out);
 await expect(second.updateAvailability(player,null)).rejects.toThrow(/another device/);
 await second.updateAvailability(saved,null);
 expect((await repo.load()).players![0]).toMatchObject({name:'Josh',availability:null,availability_revision:2});
});
