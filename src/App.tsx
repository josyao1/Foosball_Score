import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUpRight, RefreshCw, Wifi, AlertCircle } from "lucide-react";
import { useStore } from "./lib/store";
import { SiteDesign } from "./components/SiteDesign";
import { Home } from "./pages/Home";
import { RivalryPage } from "./pages/Rivalry";
import { GamePage } from "./pages/Game";
import { ConfirmDialog } from "./components/Dialog";
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export function App() {
  const store = useStore(),
    [clear, setClear] = useState(false);
  return (
    <>
      <ScrollToTop />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <img src="/favicon.svg" alt="" />
            <span>
              table<span className="brand-light">talk</span>
              <span className="brand-period">.</span>
            </span>
          </Link>
          <span className="ixl-league" aria-label="IXL League"><svg viewBox="0 0 100 38" aria-hidden="true"><path d="M1 1h15v36H1zM20 1h20l12 15L64 1h20L63 20l13 17H56L44 23 33 37H16l19-20zM79 1h15v25h6v11H79z" fill="currentColor"/></svg><span>League</span></span>
          <nav aria-label="Main navigation">
            <Link to="/">Rivalries</Link>
          </nav>
          <span className="connection">
            <i className="dot" />
            {store.cloud ? "Shared table" : "Local demo"}
          </span>
        </div>
      </header>
      <SiteDesign/>
      <main id="main" className="app-main">
        {!store.cloud && (
          <div className="demo-banner">
            <span>
              <span className="demo-badge">Demo</span>Sample rivalries to
              explore. Changes stay in this browser.
            </span>
            <button className="text-button" onClick={() => setClear(true)}>
              Start fresh
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        {store.error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={18} />
            <div>
              <strong>Couldn’t sync your table</strong>
              <p>{store.error}</p>
            </div>
            <button
              className="button secondary"
              onClick={() => void store.refresh()}
              disabled={store.busy}
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </div>
        )}
        {store.loading ? (
          <div className="empty-state">
            <RefreshCw className="loading-spinner" />
            <p>Loading…</p>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/rivalry/:id" element={<RivalryPage />} />
            <Route path="/game/:id" element={<GamePage />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>Page not found</h1>
                  <Link className="button primary" to="/">
                    Back to rivalries
                  </Link>
                </div>
              }
            />
          </Routes>
        )}
      </main>
      <footer className="app-footer">
        <span>
          tabletalk. <span className="muted">Foosball scores</span>
        </span>
        <span>
          <Wifi size={13} />
          {store.cloud ? "Shared with your friends" : "Your browser, your demo"}
        </span>
      </footer>
      {clear && (
        <ConfirmDialog
          title="Start with a clean table?"
          description="This clears all local demo rivalries and games from this browser, including any you added. Supabase records are separate."
          confirm="Clear demo data"
          danger
          onClose={() => setClear(false)}
          onConfirm={async () => {
            await store.clearDemo();
          }}
        />
      )}
    </>
  );
}
