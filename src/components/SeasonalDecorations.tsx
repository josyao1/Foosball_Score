import { useEffect, useState, type CSSProperties } from "react";
import { scheduledSeason, type SeasonalTheme } from "../lib/seasonalTheme";
import { SeasonalLeaves } from "./SeasonalLeaves";
import "./seasonal-christmas.css";

export function SeasonalDecorations({ preview }: { preview?: SeasonalTheme | "auto" }) {
  const [now, setNow] = useState(Date.now);
  const theme = preview && preview !== "auto" ? preview : scheduledSeason(now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-harvest", theme === "thanksgiving");
    document.documentElement.toggleAttribute("data-christmas", theme === "christmas");
    return () => {
      document.documentElement.removeAttribute("data-harvest");
      document.documentElement.removeAttribute("data-christmas");
    };
  }, [theme]);

  if (theme === "thanksgiving") return <SeasonalLeaves />;
  if (theme !== "christmas") return null;
  return <div className="seasonal-snow" aria-hidden="true">
    {Array.from({ length: 24 }, (_, index) => (
      <span className={`seasonal-snowflake${index % 3 ? " is-flurry" : ""}`} key={index} style={{
        "--snow-x": `${(index * 37 + 3) % 99}%`,
        "--snow-size": `${index % 3 ? 3 + index % 4 : 13 + index % 7}px`,
        "--snow-duration": `${24 + index % 13}s`,
        "--snow-delay": `${-(index * 7 % 35)}s`,
      } as CSSProperties}>
        {index % 3 === 0 && <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M16 3v26M5 9.5l22 13M5 22.5l22-13M12 6l4 4 4-4m-8 20 4-4 4 4M6 14l5-1-1-5m12 16-1-5 5-1M6 18l5 1-1 5m12-16-1 5 5 1"/>
        </svg>}
      </span>
    ))}
  </div>;
}
