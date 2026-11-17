// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { isLeafSeason, SeasonalLeaves } from "./SeasonalLeaves";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("limits the effect to November 16–30 in Pacific time", () => {
  expect(isLeafSeason(Date.parse("2026-11-16T07:59:59Z"))).toBe(false);
  expect(isLeafSeason(Date.parse("2026-11-16T08:00:00Z"))).toBe(true);
  expect(isLeafSeason(Date.parse("2026-12-01T07:59:59Z"))).toBe(true);
  expect(isLeafSeason(Date.parse("2026-12-01T08:00:00Z"))).toBe(false);
  expect(isLeafSeason(Date.parse("2027-11-20T12:00:00Z"))).toBe(false);
});

it("removes leaves when the season ends while the app is open", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-01T07:59:30Z"));
  const { container } = render(<SeasonalLeaves />);
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  expect(document.documentElement.hasAttribute("data-harvest")).toBe(true);
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(container.firstChild).toBeNull();
  expect(document.documentElement.hasAttribute("data-harvest")).toBe(false);
});

