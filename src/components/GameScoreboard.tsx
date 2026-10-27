import type { Rivalry, Side } from '../lib/types';
import '../game-scoreboards.css';

type Props = { rivalry: Rivalry; scores: Record<Side, number>; designId: string; live: boolean };
const SIDES: Side[] = ['a', 'b'];

function Kit({ side }: { side: Side }) {
  return <span className={`gs-kit gs-kit-${side}`}><i aria-hidden="true"/>{side === 'a' ? 'Black' : 'White'}</span>;
}
function Person({ side }: { side: Side }) {
  return <svg className={`gs-person gs-person-${side}`} viewBox="0 0 32 40" aria-hidden="true"><circle cx="16" cy="8" r="6"/><path d="M10 17H22L28 29L22 32L20 27V39H12V27L10 32L4 29Z"/></svg>;
}

/** Score presentations intentionally use different document structures, not palette swaps. */
export function GameScoreboard({ rivalry, scores, designId, live }: Props) {
  const name = (side: Side) => side === 'a' ? rivalry.player_a : rivalry.player_b;
  const status = live ? 'Current score' : 'Final score';
  const label = `${status}: ${rivalry.player_a}, black, ${scores.a}; ${rivalry.player_b}, white, ${scores.b}`;
  const number = (side: Side, padded = false) => <strong className="gs-number">{padded ? String(scores[side]).padStart(2, '0') : scores[side]}</strong>;
  let content;
  switch (designId) {
    case 'paper':
      content = <table className="gs-ledger"><caption>{status}</caption><thead><tr><th scope="col">Player</th><th scope="col">Kit</th><th scope="col">Goals</th></tr></thead><tbody>{SIDES.map(side => <tr key={side}><th scope="row">{name(side)}</th><td><Kit side={side}/></td><td>{number(side)}</td></tr>)}</tbody></table>;
      break;
    case 'pitch':
      content = <><div className="gs-pitch-names">{SIDES.map(side => <div key={side}><strong>{name(side)}</strong><Kit side={side}/></div>)}</div><div className="gs-field"><div className="gs-center-circle" aria-hidden="true"/>{SIDES.map(side => <div className={`gs-goal-box gs-goal-${side}`} key={side}><span className="gs-net" aria-hidden="true"/>{number(side)}</div>)}</div><p className="gs-status">{status}</p></>;
      break;
    case 'mono':
      content = <><p className="gs-status">{status}</p><div className="gs-mono-digits">{SIDES.map(side => <article key={side}>{number(side)}<div className="gs-mono-caption"><Kit side={side}/><strong>{name(side)}</strong></div></article>)}</div></>;
      break;
    case 'arcade':
      content = <><div className="gs-arcade-panels">{SIDES.map(side => <article className={`gs-digital-panel gs-digital-${side}`} key={side}><div className="gs-digital-label"><Kit side={side}/><span>Goals</span></div><div className="gs-digital-display">{number(side, true)}</div><strong className="gs-name">{name(side)}</strong></article>)}</div><p className="gs-status"><span className={live ? 'gs-live-lamp' : 'gs-final-lamp'} aria-hidden="true"/>{status}</p></>;
      break;
    case 'clay':
      content = <div className="gs-ticket"><header><span>{status}</span><span className="gs-ticket-mark" aria-hidden="true">▥</span></header><div className="gs-ticket-body">{SIDES.map(side => <div key={side}><Kit side={side}/>{number(side)}<strong className="gs-name">{name(side)}</strong></div>)}</div><footer><span>Black {scores.a}</span><span>White {scores.b}</span></footer></div>;
      break;
    case 'blueprint':
      content = <div className="gs-schematic"><div className="gs-schematic-title">{status}<span aria-hidden="true">┼</span></div><table><thead><tr><th scope="col">Position</th>{SIDES.map(side => <th scope="col" key={side}><Kit side={side}/></th>)}</tr></thead><tbody><tr><th scope="row">Player</th>{SIDES.map(side => <td key={side} className="gs-schematic-name">{name(side)}</td>)}</tr><tr><th scope="row">Goals</th>{SIDES.map(side => <td key={side}>{number(side)}</td>)}</tr></tbody></table></div>;
      break;
    case 'coral':
      content = <><div className="gs-medallions">{SIDES.map(side => <article key={side}><strong className="gs-name">{name(side)}</strong><div className={`gs-medallion gs-medallion-${side}`}>{number(side)}</div><Kit side={side}/></article>)}</div><p className="gs-status">{status}</p></>;
      break;
    case 'stadium':
      content = <div className="gs-broadcast"><div className="gs-broadcast-status"><i className={live ? 'gs-live-lamp' : 'gs-final-lamp'} aria-hidden="true"/>{status}</div><div className="gs-broadcast-strip"><div className="gs-broadcast-player"><strong>{name('a')}</strong><Kit side="a"/></div><div className="gs-broadcast-score">{number('a')}<span aria-hidden="true">:</span>{number('b')}</div><div className="gs-broadcast-player"><strong>{name('b')}</strong><Kit side="b"/></div></div></div>;
      break;
    case 'forest':
      content = <><p className="gs-status">{status}</p><div className="gs-person-rows">{SIDES.map(side => <article key={side}><Person side={side}/><div><strong className="gs-name">{name(side)}</strong><Kit side={side}/></div>{number(side)}</article>)}</div></>;
      break;
    default:
      designId = 'club';
      content = <><p className="gs-status">{status}</p><div className="gs-club-pair">{SIDES.map(side => <article key={side}><header><Kit side={side}/><strong className="gs-name">{name(side)}</strong></header>{number(side)}</article>)}</div></>;
  }
  return <div className={`game-scoreboard gs-${designId}`} role="group" aria-label={label}>{content}</div>;
}
