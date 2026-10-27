import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  DESIGNS,
  DESIGN_STORAGE_KEY,
  designSearch,
  readSavedDesign,
  resolveDesign,
} from "../lib/designs";

export function useDesign() {
  const { search } = useLocation();
  const id = resolveDesign(new URLSearchParams(search).get("design"), readSavedDesign());
  return DESIGNS.find((design) => design.id === id)!;
}

export function DesignSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const [preference, setPreference] = useState(readSavedDesign);
  const requested = new URLSearchParams(location.search).get("design");
  const selected = resolveDesign(requested, preference);

  useLayoutEffect(() => {
    document.documentElement.dataset.design = selected;
    setPreference(selected);
    try {
      localStorage.setItem(DESIGN_STORAGE_KEY, selected);
    } catch {
      // The chooser still works when browser storage is unavailable.
    }
  }, [selected]);

  useEffect(() => {
    if (requested !== selected) {
      void navigate(
        { pathname: location.pathname, search: designSearch(location.search, selected), hash: location.hash },
        { replace: true, state: location.state },
      );
    }
  }, [selected, requested, location.pathname, location.search, location.hash, location.state, navigate]);

  return (
    <div className="design-bar">
      <div className="design-bar-inner">
        <span className="design-label" id="design-label">Design</span>
        <nav className="design-options" aria-labelledby="design-label">
          {DESIGNS.map((design, index) => (
            <Link
              key={design.id}
              to={{ pathname: location.pathname, search: designSearch(location.search, design.id), hash: location.hash }}
              state={location.state}
              className={`design-option${design.id === selected ? " selected" : ""}`}
              aria-current={design.id === selected ? "true" : undefined}
              aria-label={`${String(index + 1).padStart(2, "0")} ${design.label}`}
              title={design.description}
              preventScrollReset
            >
              <span className="design-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{design.label}</span>
              <span className="design-swatches" aria-hidden="true">
                {design.swatches.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
