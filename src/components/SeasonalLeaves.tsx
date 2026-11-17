import { useEffect, useState, type CSSProperties } from "react";
import "./seasonal-leaves.css";

const START = Date.parse("2026-11-16T00:00:00-08:00");
const END = Date.parse("2026-12-01T00:00:00-08:00");

export function isLeafSeason(now: number) {
  return now >= START && now < END;
}

const leaves = [
  { x: "3%", size: 28, duration: 27, delay: -7, color: "#a55e37" },
  { x: "92%", size: 24, duration: 33, delay: -21, color: "#ad843d" },
  { x: "18%", size: 22, duration: 35, delay: -27, color: "#85623f" },
  { x: "76%", size: 30, duration: 30, delay: -12, color: "#a55e37" },
  { x: "36%", size: 26, duration: 38, delay: -17, color: "#ad843d" },
  { x: "58%", size: 22, duration: 32, delay: -3, color: "#85623f" },
  { x: "46%", size: 25, duration: 34, delay: -28, color: "#a55e37" },
  { x: "10%", size: 24, duration: 31, delay: -16, color: "#ad843d" },
  { x: "85%", size: 28, duration: 36, delay: -5, color: "#85623f" },
  { x: "28%", size: 21, duration: 29, delay: -10, color: "#a55e37" },
  { x: "66%", size: 26, duration: 37, delay: -23, color: "#ad843d" },
  { x: "97%", size: 22, duration: 32, delay: -30, color: "#85623f" },
];

export function SeasonalLeaves() {
  const [active, setActive] = useState(() => isLeafSeason(Date.now()));

  useEffect(() => {
    document.documentElement.toggleAttribute("data-harvest", active);
    return () => document.documentElement.removeAttribute("data-harvest");
  }, [active]);

  useEffect(() => {
    // Recheck after sleep as well as at the seasonal boundary.
    const update = () => setActive(isLeafSeason(Date.now()));
    const interval = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="seasonal-leaves" aria-hidden="true">
      {leaves.map((leaf, index) => (
        <span key={index} className="seasonal-leaf" style={{
          "--leaf-x": leaf.x,
          "--leaf-size": `${leaf.size}px`,
          "--leaf-duration": `${leaf.duration}s`,
          "--leaf-delay": `${leaf.delay}s`,
          color: leaf.color,
        } as CSSProperties}>
          <svg viewBox="0 0 40 48" fill="none">
            {index % 2 === 0 ? (
              <path d="m20 2 5 10 5-4-1 12 9-2-5 9 4 3-15 8-2 7-1-9L4 30l4-4-6-9 10 3-1-12 5 4Z" fill="currentColor" />
            ) : (
              <path d="M20 3C5 9 2 22 9 31c3 5 8 6 11 6 4-1 10-4 12-10C36 17 28 8 20 3Z" fill="currentColor" />
            )}
            <path d="M20 12v32m0-16-8-7m8 2 7-7m-7 17 9-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}
