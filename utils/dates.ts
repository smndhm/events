// The events are in France, and the runner's clock is in UTC: every day is told in Paris time
export const TIME_ZONE = 'Europe/Paris';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// A bare day carries no time to convert
export const isDayOnly = (date: string): boolean => DAY.test(date);

// The day in Paris, as YYYY-MM-DD, of an ISO date or of a Date
export const parisDay = (date: string | Date): string => {
  if (typeof date === 'string' && isDayOnly(date)) return date;
  // Sweden writes its dates as ISO does
  return new Date(date).toLocaleDateString('sv-SE', { timeZone: TIME_ZONE });
};

export const addDays = (day: string, days: number): string => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// The last day an event is on
export const lastDay = (event: { start: string; end?: string }): string => {
  const start = parisDay(event.start);
  const end = event.end ? parisDay(event.end) : start;
  return end < start ? start : end;
};

const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' });

// A Paris wall clock time without an offset, as some sites give it (2026-11-12T20:30:00), with the offset it has on
// that day: +01:00 in winter, +02:00 in summer
export const withParisOffset = (local: string): string => {
  const zone = offsetFormat.formatToParts(new Date(`${local}Z`)).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
  return `${local}${zone === 'GMT' ? '+00:00' : zone.slice(3)}`;
};
