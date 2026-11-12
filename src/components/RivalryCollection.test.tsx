// @vitest-environment jsdom
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RivalryCollection } from "./RivalryCollection";
import type { Game, Rivalry } from "../lib/types";

const rivalries: Rivalry[] = ["one", "two", "three"].map((id, index) => ({
  id, player_a: `Player ${index * 2 + 1}`, player_b: `Player ${index * 2 + 2}`, created_at: "2026-10-26T12:00:00Z",
}));
function finishedGames(rivalry: Rivalry, count: number): Game[] {
  return Array.from({length: count}, (_, i) => ({
    id: `${rivalry.id}-${i}`, rivalry_id: rivalry.id, revision: 1,
    started_at: `2026-10-26T12:0${i}:00Z`, ended_at: `2026-10-26T12:0${i}:30Z`, goals: [],
  }));
}
let reducedMotion = false;
let narrow = true;

function mount(items = rivalries) {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query.includes("reduced-motion") ? reducedMotion : narrow,
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  const result = render(<MemoryRouter><RivalryCollection rivalries={items} games={items.flatMap(item => finishedGames(item, 3))} layout="tickets" /></MemoryRouter>);
  const list = screen.getByRole("list", { name: "Rivalries" });
  Object.defineProperty(list, "clientWidth", { configurable: true, value: 340 });
  Object.defineProperty(list, "scrollWidth", { configurable: true, value: 980 });
  vi.spyOn(list, "getBoundingClientRect").mockImplementation(() => ({ left: 0, width: 340 } as DOMRect));
  Array.from(list.children).forEach((item, index) => {
    vi.spyOn(item, "getBoundingClientRect").mockImplementation(() => ({ left: index * 320 - list.scrollLeft, width: 306 } as DOMRect));
  });
  const scrollTo = vi.fn((options: ScrollToOptions) => {
    list.scrollLeft = Math.min(640, Math.max(0, Number(options.left)));
    fireEvent.scroll(list);
  });
  Object.defineProperty(list, "scrollTo", { configurable: true, value: scrollTo });
  fireEvent(window, new Event("resize"));
  return { ...result, list, scrollTo };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  reducedMotion = false;
  narrow = true;
});

it("moves between native scroll targets and updates accessible position and end controls", () => {
  const { list, scrollTo } = mount();
  expect(screen.getByText("Swipe left or right")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Rivalry cards" }).firstElementChild?.className).toBe("rc-ticket-carousel-controls");
  const previous = screen.getByRole("button", { name: "Previous rivalry" }) as HTMLButtonElement;
  const next = screen.getByRole("button", { name: "Next rivalry" }) as HTMLButtonElement;
  expect(previous.disabled).toBe(true);
  expect(next.disabled).toBe(false);
  fireEvent.click(next);
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 320, behavior: "smooth" });
  expect(screen.getByRole("status").textContent).toContain("2 / 3");
  expect(previous.disabled).toBe(false);
  fireEvent.click(next);
  expect(screen.getByRole("status").textContent).toContain("3 / 3");
  expect(next.disabled).toBe(true);
  list.scrollLeft = 0;
  fireEvent.scroll(list);
  expect(screen.getByRole("status").textContent).toContain("1 / 3");
});

it("supports list keyboard navigation without intercepting keys on links and honors reduced motion", () => {
  reducedMotion = true;
  const { list, scrollTo } = mount();
  expect(list.tabIndex).toBe(0);
  fireEvent.keyDown(list, { key: "End" });
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 640, behavior: "auto" });
  fireEvent.keyDown(list, { key: "Home" });
  expect(screen.getByRole("status").textContent).toContain("1 / 3");
  fireEvent.keyDown(list, { key: "ArrowRight" });
  expect(screen.getByRole("status").textContent).toContain("2 / 3");
  scrollTo.mockClear();
  fireEvent.keyDown(screen.getAllByRole("link")[0], { key: "ArrowRight" });
  expect(scrollTo).not.toHaveBeenCalled();
});

it("adapts to desktop resize and avoids carousel controls for a single ticket", () => {
  const { list, unmount } = mount();
  narrow = false;
  act(() => window.dispatchEvent(new Event("resize")));
  expect(screen.queryByRole("button", { name: "Next rivalry" })).toBeNull();
  expect(list.tabIndex).toBe(-1);
  unmount();
  narrow = true;
  mount(rivalries.slice(0, 1));
  expect(screen.queryByRole("button", { name: "Next rivalry" })).toBeNull();
  expect(screen.queryByText("Swipe left or right")).toBeNull();
});

it('features personal then frequent matchups and keeps live matchups accessible', () => {
  const items = [...rivalries, {...rivalries[0], id:'four', player_a:'Friend'},
    {...rivalries[1], id:'five', player_a:'Guest'}];
  const games = items.flatMap((item,i) => finishedGames(item, [1,4,5,1,1][i]));
  games.push({...games[0], id:'live', rivalry_id:'five', ended_at:null});
  render(<MemoryRouter><RivalryCollection rivalries={items} games={games} profile="player 1" layout="tickets"/></MemoryRouter>);
  const tickets = screen.getAllByRole('article');
  expect(tickets.map(card=>card.getAttribute('aria-label'))).toEqual(['Player 1 vs Player 2','Player 5 vs Player 6','Player 3 vs Player 4']);
  expect(within(within(tickets[2]).getByRole('region',{name:'Recent games'})).getAllByRole('link')).toHaveLength(2);
  const details = screen.getByText('Other rivalries').closest('details')!;
  expect(details.open).toBe(false);
  fireEvent.click(details.querySelector('summary')!);
  expect(within(details).getAllByRole('link').map(link=>link.getAttribute('href'))).toEqual(['/rivalry/five','/rivalry/four']);
});

it('keeps every matchup directly accessible when none qualifies for a ticket', () => {
  render(<MemoryRouter><RivalryCollection rivalries={rivalries} games={[]} layout="tickets"/></MemoryRouter>);
  expect(screen.queryByRole('article')).toBeNull();
  expect(within(screen.getByRole('region',{name:'All rivalries'})).getAllByRole('link')).toHaveLength(3);
});

it('puts the profile and their team first with the corresponding jerseys, wins and game score', () => {
  const [max, andrew, aiden] = ['Max', 'Andrew', 'Aiden'].map(name => ({id: 'id-' + name, name, created_at: ''}));
  const team = {...rivalries[0], player_a: 'Max', player_b: 'Andrew and Aiden', members: {a: [max], b: [andrew, aiden]}};
  const games = finishedGames(team, 1);
  games[0].goals = [{id:'goal', actor_side:'b', rung:'middle', flags:[], elapsed_ms:1000, occurred_at:games[0].started_at}];
  const page = (profile: string | null) => <MemoryRouter><RivalryCollection rivalries={[team]} games={games} layout="tickets" profile={profile}/></MemoryRouter>;
  const view = render(page(aiden.id));
  const ticket = screen.getByRole('article',{name:'Aiden and Andrew vs Max'});
  const first = ticket.querySelector('.rtp-identities > div')!;
  expect(first.querySelector('strong')?.textContent).toBe('Aiden and Andrew');
  expect(first.querySelectorAll('.player-jersey')).toHaveLength(2);
  expect(ticket.querySelector('.rtp-numbers')?.textContent).toBe('1–0');
  expect(within(ticket).getByRole('link',{name:/Aiden and Andrew 1, Max 0/})).toBeTruthy();
  expect(within(ticket).getByText('Aiden and Andrew · 1-win streak')).toBeTruthy();
  view.rerender(page(null));
  expect(screen.getByRole('link',{name:/Max vs Andrew and Aiden/}).textContent).toContain('0–1');
  // With three busier personal rivals, this same team moves into the directory.
  const busier = [1,2,3].map(n=>({...team,id:'busy'+n,player_a:'Opponent '+n}));
  view.rerender(<MemoryRouter><RivalryCollection rivalries={[team,...busier]} games={[...games,...busier.flatMap(item=>finishedGames(item,3))]} layout="tickets" profile={aiden.id}/></MemoryRouter>);
  fireEvent.click(screen.getByText('Other rivalries'));
  const row = screen.getByRole('link',{name:/Aiden and Andrew vs Max/});
  expect(row.textContent).toContain('1–0');
});

it('ranks personal matchups by completed games, selected-side win rate, then recency in cards and directory', () => {
  const thomas = {id:'thomas-id', name:'thomas', created_at:''};
  const specs = [
    {id:'loss-new', count:1, wins:0, day:11},
    {id:'win-old', count:1, wins:1, day:8},
    {id:'win-new', count:1, wins:1, day:10},
    {id:'busy', count:2, wins:0, day:7},
    {id:'loss-old', count:1, wins:0, day:9},
    {id:'win-middle', count:1, wins:1, day:9},
  ];
  const items = specs.map(({id}) => ({id, player_a:id, player_b:'thomas', created_at:'2026-11-01T12:00:00Z',
    members:{a:[{id, name:id, created_at:''}], b:[thomas]}}));
  const games = specs.flatMap((spec, index) => finishedGames(items[index], spec.count).map((game, i) => ({...game,
    started_at:`2026-11-${String(spec.day).padStart(2,'0')}T12:00:00Z`,
    goals:[{id:game.id+'-goal', actor_side:i < spec.wins ? 'b' as const : 'a' as const,
      rung:'attacker' as const, flags:[], elapsed_ms:1000, occurred_at:game.started_at}],
  })));
  render(<MemoryRouter><RivalryCollection rivalries={items} games={games} profile={thomas.id} layout="tickets"/></MemoryRouter>);
  expect(screen.getAllByRole('article').map(card=>card.getAttribute('aria-label'))).toEqual([
    'thomas vs busy', 'thomas vs win-new', 'thomas vs win-middle',
  ]);
  const details = screen.getByText('Other rivalries').closest('details')!;
  fireEvent.click(details.querySelector('summary')!);
  expect(within(details).getAllByRole('link').map(link=>link.getAttribute('href'))).toEqual([
    '/rivalry/win-old', '/rivalry/loss-new', '/rivalry/loss-old',
  ]);
});
