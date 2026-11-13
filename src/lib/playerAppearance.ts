import type { Player, PlayerAppearance, PlayerSettings } from './types';
export type Kit = { letters: string; school: string; color: string; trim: string; lettering?: string };
const northwestern = {school:'Northwestern',color:'#4E2A84',trim:'#FFFFFF'};
const cornell = {school:'Cornell',color:'#B31B1B',trim:'#5E3920',lettering:'#FFFFFF'};
const kits: Record<string, Kit> = {
  josh: {...northwestern,letters:'DME'},
  joshua: {...northwestern,letters:'DME'},
  brooks: {...northwestern,letters:'QZ'},
  andrew: {...cornell,letters:'PM'},
  frank: {school:'Purdue',color:'#171717',trim:'#CFB991',letters:'AA'},
  max: {school:'UCLA',color:'#2774AE',trim:'#FFD100',letters:'RSLN'},
  aiden: {...cornell,letters:'AE'},
  thomas: {school:'Wisconsin',color:'#C5050C',trim:'#FFFFFF',letters:'SC'},
  jeremy: {...northwestern,letters:'B2C'},
  jermey: {...northwestern,letters:'B2C'},
  drew: {...cornell,letters:'TE'},
  kevin: {school:'UChicago',color:'#800000',trim:'#FFFFFF',letters:'B2B'},
  alex: {school:'Michigan',color:'#00274C',trim:'#FFCB05',letters:'CE'},
};

const playerTeams: Record<string, string> = {
  josh: 'Digital Marketing Enablement',
  joshua: 'Digital Marketing Enablement',
  brooks: 'Quizzes/Demo Magic',
  frank: 'Assessment Analytics',
  andrew: 'Associate Product Manager',
  aiden: 'Admin Experience',
  max: 'Rosetta Stone',
  thomas: 'Sales Central',
  jeremy: 'B2C',
  jermey: 'B2C',
  drew: 'Teacher Experience',
  kevin: 'B2B',
  alex: 'Consumer Experience',
};
export function defaultAppearance(name: string): PlayerAppearance {
 const key=name.trim().toLowerCase();
 const kit=kits[key] ?? {letters:name.trim().slice(0,2).toUpperCase()||'TT',color:'#5C4030',trim:'#F5E9D6'};
 return {letters:kit.letters,color:kit.color,trim:kit.trim,lettering:('lettering' in kit ? kit.lettering : undefined)??kit.trim,subtitle:playerTeams[key]??''};
}
export function playerAppearance(player: Pick<Player,'name'|'appearance'>): PlayerAppearance {
 return player.appearance ?? defaultAppearance(player.name);
}
export function validatePlayerSettings(input:PlayerSettings):PlayerSettings {
 const name=input.name.trim(), a=input.appearance;
 if(!name || name.length>40)throw new Error('Enter a player name up to 40 characters.');
 if(!a || !a.letters.trim() || a.letters.trim().length>6)throw new Error('Use 1–6 characters on the jersey.');
 if(a.subtitle.trim().length>100)throw new Error('Keep the subtitle to 100 characters.');
 if(![a.color,a.trim,a.lettering].every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw new Error('Choose a valid color for each part of the jersey.');
 return {name,appearance:{letters:a.letters.trim(),subtitle:a.subtitle.trim(),color:a.color,trim:a.trim,lettering:a.lettering}};
}
