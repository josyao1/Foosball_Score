// @vitest-environment jsdom
import { MemoryRouter } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RivalryCollection } from "./RivalryCollection";
import type { Rivalry } from "../lib/types";

const rivalries: Rivalry[] = ["one", "two", "three"].map((id, index) => ({
  id, player_a: `Player ${index * 2 + 1}`, player_b: `Player ${index * 2 + 2}`, created_at: "2026-10-26T12:00:00Z",
}));
let reducedMotion = false;
let narrow = true;

function mount(items = rivalries) {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query.includes("reduced-motion") ? reducedMotion : narrow,
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  const result = render(<MemoryRouter><RivalryCollection rivalries={items} games={[]} layout="tickets" /></MemoryRouter>);
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
