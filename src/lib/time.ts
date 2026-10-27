const TIME_ZONE='America/Los_Angeles';
export const gameDate=(date:string)=>new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,month:'short',day:'numeric',year:'numeric'}).format(new Date(date));
export const gameTime=(date:string)=>new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(date));
