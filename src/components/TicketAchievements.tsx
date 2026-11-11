import { useMemo } from 'react';
import { ACHIEVEMENTS } from '../lib/achievements';
import { playerPassports } from '../lib/players';
import { useStore } from '../lib/store';
import { AchievementIcon } from './AchievementIcon';

export function TicketAchievements({ gameId, animate }: { gameId: string; animate: boolean }) {
  const { games, rivalries } = useStore();
  const earns = useMemo(() => playerPassports(games, rivalries).flatMap(player => {
    const badges = ACHIEVEMENTS.flatMap(badge => {
      const count = (player.achievementHistory[badge.id]?.findIndex(game => game.id === gameId) ?? -1) + 1;
      return count === 1 ? [{badge, count}] : [];
    });
    return badges.length ? [{player, badges}] : [];
  }), [games, rivalries, gameId]);

  if (!earns.length) return null;
  return <section className={`ticket-earns${animate ? ' ticket-earns-new' : ''}`} aria-label="Achievements earned this game">
    {earns.map(({player, badges}) => <div className="ticket-earner" key={player.key}>
      <strong>{player.name}</strong>
      <ul>{badges.map(({badge, count}) => <li key={badge.id} className={count === 1 ? 'first-earn' : 'repeat-earn'}
        title={`${badge.name} · ${count === 1 ? 'First earn' : `Earned ×${count}`}`}>
        <span className="ticket-emblem" style={{color: badge.color}}><AchievementIcon id={badge.id}/></span>
        <span>{badge.name}</span>{count > 1 && <b className="ticket-earn-count">×{count}</b>}
      </li>)}</ul>
    </div>)}
  </section>;
}
