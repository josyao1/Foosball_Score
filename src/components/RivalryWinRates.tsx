import { useMemo } from 'react';
import { recordBook } from '../lib/records';
import type { Game, Rivalry, Side } from '../lib/types';
const rows = [['opener', 'After scoring first'], ['clutch', 'After reaching 9–9'], ['comeback', 'After trailing by 3+'], ['matchPoint', 'After holding match point']] as const;
export function RivalryWinRates({games, rivalry, totals}: {games: Game[]; rivalry: Rivalry; totals: {wins: Record<Side,number>; goals: Record<Side,number>}}) {
  const {rates} = useMemo(() => recordBook(games.filter(game => game.rivalry_id === rivalry.id)), [games, rivalry.id]);
  return <table className="rs-win-rates" aria-label="Rivalry win rates">
    <thead><tr><th scope="col" aria-label="Statistic"/><th scope="col"><span className="rs-rate-player"><i className="rs-rate-dot black" aria-hidden="true"/>{rivalry.player_a}</span></th><th scope="col"><span className="rs-rate-player"><i className="rs-rate-dot white" aria-hidden="true"/>{rivalry.player_b}</span></th></tr></thead>
    <tbody className="rs-comparison-totals"><tr className="rs-comparison-wins"><th scope="row">Wins</th><td><strong>{totals.wins.a}</strong></td><td><strong>{totals.wins.b}</strong></td></tr><tr><th scope="row">Total goals</th><td>{totals.goals.a}</td><td>{totals.goals.b}</td></tr></tbody>
    <tbody><tr className="rs-comparison-divider"><th colSpan={3}>Win rate</th></tr>{rows.map(([key,label]) => <tr key={key}><th scope="row">{label}</th>{(['a','b'] as const).map(side => {
      const [wins,total] = rates[side][key];
      return <td key={side}>{total ? <><strong>{Math.round(wins/total*100)}%</strong><small>{wins}/{total}</small></> : <span aria-label="No qualifying games">—</span>}</td>;
    })}</tr>)}</tbody>
  </table>;
}
