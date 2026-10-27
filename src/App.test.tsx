// @vitest-environment jsdom
import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { StoreProvider } from "./lib/store";
vi.mock("./lib/supabase", () => ({
  cloudConfigured: false,
  createCloudRepository: () => {
    throw new Error("Cloud is not used in the local-mode startup test");
  },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
it("loads and unmounts when scrollTo returns a Promise in newer browsers", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation((() =>
    Promise.resolve()) as typeof window.scrollTo);
  const { unmount } = render(
    <StrictMode>
      <MemoryRouter>
        <StoreProvider>
          <App />
        </StoreProvider>
      </MemoryRouter>
    </StrictMode>,
  );
  expect(
    await screen.findByRole("heading", { name: "Rivalries" }),
  ).toBeTruthy();
  expect(() => unmount()).not.toThrow();
});
