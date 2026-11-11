import './player-jersey.css';

type Kit = { letters: string; school: string; color: string; trim: string };
const northwestern = {school:'Northwestern',color:'#4E2A84',trim:'#FFFFFF'};
const cornell = {school:'Cornell',color:'#B31B1B',trim:'#FFFFFF'};
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
};

export function PlayerJersey({name, decorative = false}: {name:string; decorative?:boolean}) {
  const kit = kits[name.trim().toLowerCase()] ?? {
    letters:name.trim().slice(0,2).toUpperCase() || 'TT',
    school:'Table Talk',color:'#5C4030',trim:'#F5E9D6',
  };
  return <svg className="player-jersey" viewBox="0 0 100 108" role={decorative ? undefined : 'img'}
    aria-hidden={decorative || undefined} focusable="false"
    aria-label={decorative ? undefined : `${name}: ${kit.letters} jersey in ${kit.school} colors`}>
    <path fill={kit.color} stroke={kit.color} strokeWidth="2" strokeLinejoin="round"
      d="M33 8L20 14 4 36 20 48 27 39 24 98Q50 104 76 98L73 39 80 48 96 36 80 14 67 8Q50 17 33 8Z"/>
    <path d="M34 9Q50 32 66 9" fill="none" stroke={kit.trim} strokeWidth="4"/>
    <path d="M8 32L22 42M78 42L92 32" fill="none" stroke={kit.trim} strokeWidth="4"/>
    <path d="M29 88H71" fill="none" stroke={kit.trim} strokeWidth="2" opacity=".45"/>
    <path d="M29 42L27 83M71 42L73 83" fill="none" stroke={kit.trim} opacity=".17"/>
    <text x="50" y="64" textAnchor="middle" fill={kit.trim}
      fontFamily="'DM Sans', Arial, sans-serif" fontWeight="650" fontSize={kit.letters.length>3?15:18}
      letterSpacing=".3">{kit.letters}</text>
  </svg>;
}
