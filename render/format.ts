import { addDays, isDayOnly, lastDay, parisDay, TIME_ZONE } from '../utils/dates.ts';
import type { KnownEvent, Segment } from '../types.ts';

// A line of details as text, its links as their text
export const segmentsText = (segments: Segment[]): string => segments.map(({ text }) => text).join('');

// A line of details as HTML, its links as links, their hint for screen readers only
export const segmentsHtml = (segments: Segment[]): string =>
  segments
    .map(({ text, url, hint }) => (url ? `<a href="${escape(url)}">${escape(text)}${hint ? `<span class="ds-u-visually-hidden">, ${escape(hint)}</span>` : ''}</a>` : escape(text)))
    .join('');

export const escape = (text: string): string => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });

const atNoon = (day: string): Date => new Date(`${day}T12:00:00Z`);

// "samedi 15 novembre", or "Aujourd'hui" and "Demain", which read faster
export const dayTitle = (day: string, today: string): string => {
  if (day === today) return "Aujourd'hui";
  if (day === addDays(today, 1)) return 'Demain';
  const title = dayFormat.format(atNoon(day));
  return title.charAt(0).toUpperCase() + title.slice(1);
};

export const shortDay = (day: string): string => shortDayFormat.format(atNoon(day));

// The details a source gave, such as a film's showtimes; else "10:00 – 18:00", "jusqu'au dim. 16 nov.", or nothing for a
// bare day
export const when = (event: KnownEvent): string => {
  if (event.details) return event.details.map(segmentsText).join(' ; ');
  const last = lastDay(event);
  if (last !== parisDay(event.start)) return `jusqu'au ${shortDay(last)}`;
  if (isDayOnly(event.start)) return '';
  const start = timeFormat.format(new Date(event.start));
  return event.end && !isDayOnly(event.end) ? `${start} – ${timeFormat.format(new Date(event.end))}` : start;
};

// "Hennebont, 12 km", the number and its unit kept on one line
export const where = (event: KnownEvent): string => [event.place, event.distance === undefined ? '' : `${event.distance}\u00a0km`].filter(Boolean).join(', ');

// The day an event is listed under: its first, or today for one that started before and is still on
export const listedOn = (event: KnownEvent, today: string): string => {
  const start = parisDay(event.start);
  return start < today ? today : start;
};
