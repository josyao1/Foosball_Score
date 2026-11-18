import { useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RivalryCollection } from '../components/RivalryCollection';
import { useProfile } from '../lib/profile';
import { useStore } from '../lib/store';
import { sidePlayers } from '../lib/participants';

export function Rivalries() {
  const { rivalries, games } = useStore();
  const profile = useProfile();
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('all');
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rivalries.filter(rivalry => {
    const first = sidePlayers(rivalry, 'a'), second = sidePlayers(rivalry, 'b');
    const teamGame = first.length > 1 || second.length > 1;
    if ((format === 'singles' && teamGame) || (format === 'teams' && !teamGame)) return false;
    const names = [...first, ...second].map(player => player.name.toLowerCase()).join(' ');
    return terms.every(term => names.includes(term));
  });
  const filtering = terms.length > 0 || format !== 'all';
  return <>
    <Link className="rivalry-directory-back" to="/rivalries"><ArrowLeft size={16} aria-hidden="true"/>Featured rivalries</Link>
    <div className="rivalry-directory-heading"><h1>All rivalries</h1><span role="status">{filtering ? `${filtered.length} of ${rivalries.length}` : rivalries.length}</span></div>
    {rivalries.length > 0 && <div className="rivalry-directory-filters">
      <div className="rivalry-directory-search">
        <Search size={17} aria-hidden="true"/>
        <input type="search" aria-label="Search rivalries by player name" placeholder="Search players…" value={query}
          onChange={event => setQuery(event.target.value)} autoComplete="off"/>
        {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} aria-hidden="true"/></button>}
      </div>
      <select className="rivalry-directory-format" aria-label="Rivalry format" value={format} onChange={event => setFormat(event.target.value)}>
        <option value="all">All matchups</option><option value="singles">Singles</option><option value="teams">Teams</option>
      </select>
    </div>}
    {filtered.length ? <RivalryCollection rivalries={filtered} games={games} profile={profile} layout="directory"/>
      : <div className="rivalry-directory-empty"><p>{rivalries.length ? 'No matching rivalries.' : 'No rivalries yet.'}</p>
        {filtering && <button type="button" className="text-button" onClick={() => {setQuery(''); setFormat('all');}}>Clear filters</button>}
      </div>}
  </>;
}
