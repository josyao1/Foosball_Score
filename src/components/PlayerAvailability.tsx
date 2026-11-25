import type { AvailabilityDraft } from '../lib/types';
import './player-availability.css';

function estimatedReturn(date:string) {
  if(!date) return 'Return date TBD';
  const parsed=new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'Return date TBD' : `Est. return ${parsed.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
}

export function PlayerOutJerseyTag() {
  return <span className="player-jersey-out-tag" aria-label="Out">OUT</span>;
}

export function PlayerAvailabilityInline({draft}:{draft:AvailabilityDraft}) {
  const reason=draft.reason.trim()||'Away from the table';
  const fullReturn=estimatedReturn(draft.returnDate);
  return <span className="passport-out-inline" title={`${reason}. ${fullReturn}`}>
    <span>{reason}</span><small aria-label={fullReturn}>{fullReturn.replace('Est. return ','Est. ').replace('Return date TBD','Return TBD')}</small>
  </span>;
}
