import { useMemo } from 'react';
import { displayTeams, orderRivalries } from '../lib/participants';
import { useProfile } from '../lib/profile';
import type { Game, Rivalry } from '../lib/types';

export function RivalryOptions({rivalries, games}: {rivalries: Rivalry[]; games: Game[]}) {
  const profile = useProfile();
  const options = useMemo(() => orderRivalries(rivalries, games, profile).map(rivalry => {
    const [first, second] = displayTeams(rivalry, profile);
    return <option key={rivalry.id} value={rivalry.id}>{first.name} vs {second.name}</option>;
  }), [rivalries, games, profile]);

  return <><option value="">All rivalries</option>{options}</>;
}
