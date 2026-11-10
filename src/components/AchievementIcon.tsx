import type { AchievementId } from '../lib/achievements';
/** Each achievement has its own drawn emblem, sharing the same stamp frame. */
export function AchievementIcon({id}:{id:AchievementId}) {
  const figure=<><circle cx="24" cy="15" r="3"/><path d="M20 20h8v11h-3v8h-2v-8h-3z"/></>;
  const art={
    escape:<><path d="M16 22v-5a8 8 0 0 1 15-4M15 24h18v15H15zM25 26l-4 5 5 2-4 5"/></>,
    dunk:<><path d="M27 8L16 25h9l-4 12 14-19H25zM10 31v10h28V31M14 35h6m9 0h5"/></>,
    bank:<><path d="M10 10v28h28M14 14l18 10-14 10M26 24h6v6"/><circle cx="13" cy="13" r="3"/></>,
    gift:<><path d="M11 22h26v7H11zM14 29v12h20V29M24 22v19M24 21c-17-2-10-14-3-6l3 6c17-2 10-14 3-6z"/></>,
    rungRun:<>{[10,17,24,31,38].map(x=><g key={x}><circle cx={x} cy="20" r="2"/><path d={`M${x} 24v8`}/></g>)}<path d="M7 26h34"/></>,
    perfect:<><path d="M13 7h17l6 6v28H13zM29 7v8h7M18 31l5-13 5 13M20 26h6M31 20v6m-3-3h6"/></>,
    extra:<><path d="M17 15h14v10a7 7 0 0 1-14 0zM17 18h-6v4a7 7 0 0 0 7 7m13-11h6v4a7 7 0 0 1-7 7M24 32v7m-7 2h14M24 6v4M13 9l3 3m19-3-3 3"/></>,
    comeback:<><path d="M12 19h17a10 10 0 0 1 0 20H18M12 19l8-9m-8 9 8 8"/></>,
    goalie:<><circle cx="34" cy="15" r="6"/><path d="M32 12l4 1 1 4-4 2-3-4zM8 37c7-14 11-19 18-20M7 27l6-7m3 16 6-8"/></>,
    speed:<><circle cx="27" cy="27" r="13"/><path d="M24 8h6m-3 1v5m0 6v8l7-4M4 20h10M3 27h8M7 34h6"/></>,
    reply:<><path d="M17 9L9 25h8l-4 11 13-17h-8zM33 39l8-16h-8l4-11-13 17h8z"/></>,
    own:<g transform="rotate(180 24 24)">{figure}<path d="M9 26h30M13 8l-3 3m28-3-3 3"/></g>,
    doubleAgent:<>{figure}<path d="M16 12h16l-3-5H19zM19 16h10M11 26h8m10 0h8M22 22l2 4 2-4"/></>,
    trading:<><path d="M10 28l-3-7 3-8h8l5 6-1 8-6 3zM38 20l3 7-3 8h-8l-5-6 1-8 6-3zM12 30l3 7 8-4-3-6M36 18l-3-7-8 4 3 6M21 10l3-4m0 36 3-4"/></>,
    closing:<><path d="M9 9h30v30H9zM9 15h30M9 21h30M9 27h30M21 33h6M6 42h36"/></>,
    neverDoubt:<><path d="M24 6l15 6v12c0 9-15 18-15 18S9 33 9 24V12zM24 32V17m-6 6 6-6 6 6"/></>,
    breaker:<><path d="M19 13l-2-2a7 7 0 0 0-10 10l7 7a7 7 0 0 0 9 1M29 35l2 2a7 7 0 0 0 10-10l-7-7a7 7 0 0 0-9-1M13 18l7 7m8-2 7 7M26 5l-3 8m14-4-6 6M11 39l6-6"/></>,
    around:<><path d="M12 9h24q5 0 5 5v20q0 5-5 5H12q-5 0-5-5V14q0-5 5-5zM7 24h34M14 14v20m7-20v20m7-20v20m7-20v20"/>{[14,21,28,35].map((x,i)=><path key={x} d={`M${x-2} ${17+i*3}h4v4h-4z`} fill="currentColor"/>)}</>,
    fullHouse:<><path d="M9 20L24 7l15 13M13 19v21h22V19"/>{[[19,23],[29,23],[19,33],[29,33]].map(([x,y])=><circle key={`${x}-${y}`} cx={x} cy={y} r="3"/>)}</>,
    streak:<><path d="M8 16h32v24H8zM12 9h24M16 4h16"/><path d="M29 21H19v6h8a5 5 0 1 1-8 6"/></>,
    tightrope:<><path d="M5 37q19-5 38 0M24 17v10l-6 9m6-9 7 8M12 22l12-3 12 3M5 34v7m38-7v7"/><circle cx="24" cy="10" r="4"/></>,
    circus:<><path d="M7 25L24 12l17 13M10 25v16h28V25M5 41h38M24 12V5l8 3-8 3M18 41V29h12v12M17 18l3 7m11-7-3 7"/><circle cx="9" cy="10" r="2"/><circle cx="39" cy="9" r="2"/></>,
    marathon:<><path d="M13 7h22M13 41h22M16 7v8c0 5 16 13 16 18v8M32 7v8c0 5-16 13-16 18v8M18 34h12M20 14h8"/><path d="M6 16v16m36-16v16"/></>,
    groupProject:<>{[15,33].map(x=><g key={x}><circle cx={x} cy="12" r="4"/><path d={`M${x-4} 19h8v12h-3v9h-2v-9h-3z`}/></g>)}<path d="M6 25h36M21 7h6"/></>,
    seatWarmer:<><path d="M17 10v18h17V18M17 22h17M20 28v10m11-10v10M8 18a17 17 0 0 1 30-8m0-6v6h-6M40 30a17 17 0 0 1-30 8m0 6v-6h6"/></>,
    sixtySeven:<><path d="M20 12c-9-2-12 7-12 15s13 11 13 2-13-9-13-1M28 12h13L30 38"/></>,
    fourTwenty:<><path d="M24 41V26M24 32C17 33 11 31 7 27l11 1C10 24 7 18 6 12c8 3 12 8 15 14C18 17 20 9 24 5c4 4 6 12 3 21 3-6 7-11 15-14-1 6-4 12-12 16l11-1c-4 4-10 6-17 5z"/></>,
    ethical:<><path d="M13 23v-8l11-5 11 5v8c0 8-7 14-11 16-4-2-11-8-11-16Z"/><path d="m18 24 4 4 8-9"/></>,
    hardCarry:<><path d="M8 30h32M12 26v8m24-8v8M19 39l3-9m7 9-3-9M17 24l5-5h5l5 5"/><circle cx="24" cy="13" r="4"/><path d="m9 18 2-4 2 4m22 0 2-4 2 4"/></>,
    lunchBreak:<><path d="M9 18h30v23H9zM17 18v-6h14v6M9 26h30M21 24h6v4h-6z"/><circle cx="34" cy="12" r="8"/><path d="M34 7v5l4 2"/></>,
  }[id];
  return <svg className="achievement-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{art}</svg>;
}
