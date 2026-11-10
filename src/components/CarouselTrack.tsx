import { GoalBall } from './GoalBall';
import './carousel-track.css';

export function updateCarouselProgress(list: HTMLUListElement) {
  const travel = list.scrollWidth - list.clientWidth;
  const progress = travel > 0 ? Math.max(0, Math.min(1, list.scrollLeft / travel)) : 0;
  list.parentElement?.style.setProperty('--swipe-progress', String(progress));
}

export function CarouselTrack({index, count, label, controls, goTo}: {
  index: number; count: number; label: string; controls: string; goTo: (index:number) => void;
}) {
  return <div className="carousel-ball-track">
    <span aria-hidden="true"><GoalBall size={18}/></span>
    <input type="range" min={0} max={count - 1} value={index} aria-label={label}
      aria-controls={controls} aria-valuetext={`${index + 1} of ${count}`}
      onChange={event => goTo(Number(event.target.value))}/>
  </div>;
}
