// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RivalrySummary } from './RivalrySummary';
import { RecordBook } from './Records';
import { createRecordDemoData } from '../test/fixtures/recordGames';
afterEach(cleanup);
it('puts rivalry win rates inside the Clay ticket and removes the draws stamp and duplicate section',()=>{
 const data=createRecordDemoData(), rivalry=data.rivalries[0], games=data.games.filter(g=>g.rivalry_id===rivalry.id);
 render(<MemoryRouter><RivalrySummary rivalry={rivalry} games={games} designId="clay"/><RecordBook rivalry={rivalry} games={games}/></MemoryRouter>);
 const ticket=screen.getByRole('region',{name:'Head to head ticket'});
 expect(within(ticket).queryByText(/draws/i)).toBeNull();
 expect(within(ticket).getByRole('table',{name:'Rivalry win rates'})).toBeTruthy();
 expect(screen.getAllByRole('table',{name:'Rivalry win rates'})).toHaveLength(1);
 expect(within(ticket).getByText('After scoring first')).toBeTruthy();
 expect(within(ticket).getByRole('rowheader',{name:'After holding match point'})).toBeTruthy();
 expect(screen.queryByText('More rivalry stats')).toBeNull();
});
