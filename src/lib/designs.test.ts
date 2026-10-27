// @vitest-environment jsdom
import { createElement } from "react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DesignSwitcher, useDesign } from "../components/DesignSwitcher";
import { DESIGN_STORAGE_KEY, designSearch, readSavedDesign, resolveDesign } from "./designs";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.design;
  vi.restoreAllMocks();
});

function RouteProbe() {
  const location = useLocation();
  const design = useDesign();
  return createElement("div", null,
    createElement("output", { "data-testid": "route" }, location.pathname + location.search + location.hash),
    createElement("output", { "data-testid": "layout" }, design.homeLayout + "/" + design.statsLayout + "/" + design.scorerLayout),
    createElement(Link, { to: "/rivalry/test" }, "Open rivalry"),
  );
}
function mount(initial: string) {
  render(createElement(MemoryRouter, { initialEntries: [initial] },
    createElement(DesignSwitcher), createElement(RouteProbe),
  ));
}
it("switches design while retaining the current game, other query values and anchor", () => {
  mount("/game/test?filter=live&design=club#goals");
  fireEvent.click(screen.getByRole("link", { name: "02 Paper" }));
  expect(screen.getByTestId("route").textContent).toBe("/game/test?filter=live&design=paper#goals");
  expect(screen.getByTestId("layout").textContent).toBe("list/table/rows");
  expect(document.documentElement.dataset.design).toBe("paper");
  expect(localStorage.getItem(DESIGN_STORAGE_KEY)).toBe("paper");
  expect(screen.getByRole("link", { name: "02 Paper" }).getAttribute("aria-current")).toBe("true");
  fireEvent.click(screen.getByRole("link", { name: "Open rivalry" }));
  expect(screen.getByTestId("route").textContent).toBe("/rivalry/test?design=paper");
  expect(document.documentElement.dataset.design).toBe("paper");
});
it("uses a saved style for invalid URLs and allows explicit shared URLs to override it", () => {
  localStorage.setItem(DESIGN_STORAGE_KEY, "forest");
  mount("/?design=missing");
  expect(screen.getByTestId("route").textContent).toBe("/?design=forest");
  cleanup();
  mount("/?design=arcade");
  expect(document.documentElement.dataset.design).toBe("arcade");
});
it("works when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage denied"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage denied"); });
  expect(readSavedDesign()).toBe("club");
  mount("/game/test");
  fireEvent.click(screen.getByRole("link", { name: "07 Blueprint" }));
  expect(document.documentElement.dataset.design).toBe("blueprint");
  fireEvent.click(screen.getByRole("link", { name: "Open rivalry" }));
  expect(document.documentElement.dataset.design).toBe("blueprint");
});
it("validates untrusted style values and keeps exactly one selected design in the URL", () => {
  expect(resolveDesign("__proto__", "unknown")).toBe("club");
  expect(resolveDesign(null, "mono")).toBe("mono");
  const params = new URLSearchParams(designSearch("?design=club&design=paper&filter=all", "clay"));
  expect(params.getAll("design")).toEqual(["clay"]);
  expect(params.get("filter")).toBe("all");
});
