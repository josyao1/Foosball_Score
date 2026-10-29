import { useId } from 'react';
import { goalShare } from '../lib/distribution';
import { gameStats } from '../lib/stats';
import { RUNGS, playerName } from '../lib/types';
import type { Game, GoalFlag, Rivalry, Rung, Side } from '../lib/types';
import { GoalBall } from './GoalBall';
import './game-rung-stats.css';

const FIGURES: Record<Rung, number> = {goalie:3, defender:2, middle:5, attacker:3};
const LABELS: Record<Rung, string> = {goalie:'Goalie', defender:'Defender', middle:'Middle', attacker:'Attacker'};
const SIDES: Side[] = ['a', 'b'];

function Rod({ rung }: {rung:Rung}) {
  return <div className="stats-rod" aria-hidden="true">
    <span className="stats-rod-shaft"/>
    <div className="stats-rod-figures">{[...Array(FIGURES[rung])].map((_, index) => <svg className="stats-rod-figure" key={index} viewBox="-6 0 12 30" width="12" height="30">
      <circle cx="0" cy="6" r="3.5"/>
      <path d="M-5 11Q-5 9-3 9H3Q5 9 5 11V17H3V22H4V26H-4V22H-3V17H-5Z"/>
      <path className="stats-rod-shirt" d="M-2 12H2"/>
    </svg>)}</div>
  </div>;
}

export function RungTable({rungs, rivalry, totals}: {
  rungs:Record<Side,Record<Rung,number>>; rivalry:Rivalry; totals?:Record<Side,number>;
}) {
  const most = {a:Math.max(...Object.values(rungs.a)), b:Math.max(...Object.values(rungs.b))};
  return (
    <div className={`rung-table${totals ? " rung-table-with-shares" : ""}`}>
      <div className="rung-table-players">
        {SIDES.map(side => <span key={side} className={`rung-table-player side-${side}`}><span className="rung-player-name"><i className={`stats-kit stats-kit-${side}`} aria-hidden="true"/><strong>{playerName(rivalry,side)}</strong></span>{totals && <small>{totals[side]} goals scored</small>}</span>)}
      </div>
      <div className="rung-table-field">
        <span className="rung-table-goal goal-top" aria-hidden="true"/>
        <span className="rung-table-goal goal-bottom" aria-hidden="true"/>
        <div className="rung-field-markings" aria-hidden="true"><i/></div>
        {RUNGS.map(rung => {
          const topA = rungs.a[rung] > 0 && rungs.a[rung] === most.a;
          const topB = rungs.b[rung] > 0 && rungs.b[rung] === most.b;
          return <div key={rung} className={`rung-table-row${topA ? ' top-rung-a' : ''}${topB ? ' top-rung-b' : ''}`} role="group" aria-label={`${LABELS[rung]} rung`}>
            <strong className={`rung-table-count${rungs.a[rung] ? '' : ' is-zero'}`} aria-label={`${rivalry.player_a}: ${rungs.a[rung]} ${rungs.a[rung] === 1 ? "goal" : "goals"}${topA ? ', most-used rung' : ''}${totals ? `, ${goalShare(rungs.a[rung], totals.a)}% of goals scored` : ''}`}>{rungs.a[rung]}{totals && <small>{goalShare(rungs.a[rung], totals.a)}%</small>}</strong>
            <div className="rung-table-rod"><span>{LABELS[rung]}</span><Rod rung={rung}/></div>
            <strong className={`rung-table-count${rungs.b[rung] ? '' : ' is-zero'}`} aria-label={`${rivalry.player_b}: ${rungs.b[rung]} ${rungs.b[rung] === 1 ? "goal" : "goals"}${topB ? ', most-used rung' : ''}${totals ? `, ${goalShare(rungs.b[rung], totals.b)}% of goals scored` : ''}`}>{rungs.b[rung]}{totals && <small>{goalShare(rungs.b[rung], totals.b)}%</small>}</strong>
          </div>;
        })}
      </div>
      <p className="rung-table-note">Shaded ends mark each player’s most-used rung.</p>
    </div>
  );
}

export function RungStats({game, rivalry}: {game:Game;rivalry:Rivalry}) {
  const id = useId();
  const stats = gameStats(game);
  const types: {label:string;flags:GoalFlag[];totals:Record<Side,number>}[] = [
    {label:'Dunks',flags:['dunk'],totals:stats.dunks},
    {label:'Bank shots',flags:['bank'],totals:stats.banks},
    {label:'Own goals made',flags:['own_goal'],totals:stats.ownGoals},
  ];
  const combined = game.goals.some(goal => goal.flags.includes('dunk') && goal.flags.includes('bank'));
  return <section className="panel game-rung-stats" aria-labelledby={`${id}-rungs`}>
    <header className="section-heading compact"><div><h2 id={`${id}-rungs`}>Goals by rung</h2><p>Where you scored. Own goals excluded.</p></div></header>
    <RungTable rungs={stats.rungs} rivalry={rivalry}/>
    <section className="game-goal-types" aria-labelledby={`${id}-types`}>
      <h3 id={`${id}-types`}>Goal types</h3>
      <div className="game-goal-type-groups">
        {types.map(({label,flags,totals}) => <section className={`game-goal-type type-${flags[0]}`} aria-label={label} key={label}>
          <header><span aria-hidden="true"><GoalBall flags={flags} size={30}/></span><h4>{label}</h4></header>
          <dl>{SIDES.map(side => <div key={side}><dt><i className={`stats-kit stats-kit-${side}`} aria-hidden="true"/>{playerName(rivalry,side)}</dt><dd className={totals[side] === 0 ? 'is-zero' : ''}>{totals[side]}</dd></div>)}</dl>
        </section>)}
      </div>
      {combined && <p className="rung-table-note">Dunk + bank goals count in both types.</p>}
    </section>
  </section>;
}
