import { CarouselTrack, updateCarouselProgress } from './CarouselTrack';
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function ticketOffset(list: HTMLUListElement, index: number) {
  const item = list.children[index];
  if (!item) return 0;
  const padding = Number.parseFloat(getComputedStyle(list).scrollPaddingLeft) || 0;
  const left = item.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - padding;
  return Math.max(0, Math.min(left, list.scrollWidth - list.clientWidth));
}

export function PlayerCarousel({ entries }: { entries: {id:string;content:ReactNode}[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const hintId = useId();
  const [narrow, setNarrow] = useState(false);
  const [current, setCurrent] = useState(0);
  const entryIds = entries.map(entry => entry.id).join("|");
  const index = Math.min(current, entries.length - 1);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const sync = () => {
      const mobile = typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 760px)").matches
        : window.innerWidth <= 760;
      setNarrow(mobile);
      let nearest = 0;
      let distance = Infinity;
      if (mobile && list.scrollWidth > list.clientWidth) {
        for (let i = 0; i < list.children.length; i++) {
          const delta = Math.abs(ticketOffset(list, i) - list.scrollLeft);
          if (delta < distance) { nearest = i; distance = delta; }
        }
      }
      updateCarouselProgress(list);
      setCurrent(nearest);
    };
    list.scrollLeft = 0;
    sync();
    list.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(list);
    return () => {
      list.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      observer?.disconnect();
    };
  }, [entryIds]);

  function goTo(target: number) {
    const list = listRef.current;
    if (!list) return;
    const next = Math.max(0, Math.min(target, entries.length - 1));
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: ticketOffset(list, next), behavior: reduce ? "auto" : "smooth" });
  }

  const carousel = narrow && entries.length > 1;
  return (
    <div className="player-carousel" role="region" aria-label="Player passports" aria-roledescription={carousel ? "carousel" : undefined}>
      {carousel && <div className="player-carousel-controls">
        <span id={hintId}>Swipe left or right<span className="rc-sr">. Use the arrow keys, Home, or End when the list is focused.</span></span>
        <div className="player-carousel-navigation">
          <button type="button" aria-label="Previous player" aria-controls={listId} disabled={index === 0} onClick={() => goTo(index - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <span role="status" aria-live="polite" aria-atomic="true">{index + 1} / {entries.length}<span className="rc-sr"> players</span></span>
          <button type="button" aria-label="Next player" aria-controls={listId} disabled={index === entries.length - 1} onClick={() => goTo(index + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>}
      <ul
        id={listId}
        ref={listRef}
        className={`passport-grid player-carousel-list${entries.length === 1 ? " player-carousel-single" : ""}`}
        aria-label="Players"
        aria-describedby={carousel ? hintId : undefined}
        tabIndex={carousel ? 0 : undefined}
        onKeyDown={event => {
          if (!carousel || event.target !== event.currentTarget) return;
          const target = event.key === "ArrowLeft" ? index - 1 : event.key === "ArrowRight" ? index + 1 : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : null;
          if (target === null) return;
          event.preventDefault();
          goTo(target);
        }}
      >
        {entries.map((entry, i) => <li key={entry.id} aria-label={carousel ? `${i + 1} of ${entries.length}` : undefined}>{entry.content}</li>)}
      </ul>
      {carousel && <CarouselTrack index={index} count={entries.length} label="Player position" controls={listId} goTo={goTo}/>}
    </div>
  );
}
