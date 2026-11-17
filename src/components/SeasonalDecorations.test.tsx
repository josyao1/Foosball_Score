// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { scheduledSeason, seasonalPreview } from "../lib/seasonalTheme";
import { SeasonalDecorations } from "./SeasonalDecorations";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("switches the saved seasons at Pacific midnight and ends after December", () => {
  expect(scheduledSeason(Date.parse("2026-11-16T07:59:59Z"))).toBeNull();
  expect(scheduledSeason(Date.parse("2026-11-16T08:00:00Z"))).toBe("thanksgiving");
  expect(scheduledSeason(Date.parse("2026-12-01T07:59:59Z"))).toBe("thanksgiving");
  expect(scheduledSeason(Date.parse("2026-12-01T08:00:00Z"))).toBe("christmas");
  expect(scheduledSeason(Date.parse("2027-01-01T07:59:59Z"))).toBe("christmas");
  expect(scheduledSeason(Date.parse("2027-01-01T08:00:00Z"))).toBeNull();
  expect(scheduledSeason(Date.parse("2027-11-20T12:00:00Z"))).toBeNull();
});

it("changes decorations on an already-open page, then clears them in January", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-01T07:59:30Z"));
  const { container } = render(<SeasonalDecorations />);
  expect(container.querySelector(".seasonal-leaves")).not.toBeNull();
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(container.querySelector(".seasonal-leaves")).toBeNull();
  expect(container.querySelector(".seasonal-snow")).not.toBeNull();
  expect(document.documentElement.hasAttribute("data-harvest")).toBe(false);
  expect(document.documentElement.hasAttribute("data-christmas")).toBe(true);
  act(() => {
    vi.setSystemTime(new Date("2027-01-01T08:00:00Z"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(container.firstChild).toBeNull();
  expect(document.documentElement.hasAttribute("data-christmas")).toBe(false);
});

it("previews Christmas without losing the approved Thanksgiving option", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
  const { container, rerender, unmount } = render(<SeasonalDecorations preview="christmas" />);
  expect(container.querySelector(".seasonal-snow")).not.toBeNull();
  rerender(<SeasonalDecorations preview="thanksgiving" />);
  expect(container.querySelector(".seasonal-leaves")).not.toBeNull();
  expect(document.documentElement.hasAttribute("data-christmas")).toBe(false);
  unmount();
  expect(document.documentElement.hasAttribute("data-harvest")).toBe(false);
});

it("keeps local preview overrides out of production", () => {
  expect(seasonalPreview(true, "")).toBe("christmas");
  expect(seasonalPreview(true, "?season=thanksgiving")).toBe("thanksgiving");
  expect(seasonalPreview(true, "?season=auto")).toBe("auto");
  expect(seasonalPreview(false, "?season=christmas")).toBeUndefined();
});
