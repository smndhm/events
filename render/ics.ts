// An event in a calendar file (iCalendar, RFC 5545), the standard every calendar reads (Apple, Google, Outlook,
// Thunderbird...): one file per event or film showtime, which a link adds to the visitor's calendar.
import { createHash } from 'node:crypto';
import { addDays, isDayOnly } from '../utils/dates.ts';
import type { KnownEvent, Showing } from '../types.ts';

// What a calendar event says
export type CalendarEvent = {
  uid: string;
  title: string;
  // ISO 8601 with its offset, or a bare day for an event on whole days
  start: string;
  end?: string;
  location?: string;
  url: string;
};

// Without a duration, an event at a time is given two hours
const DEFAULT_MINUTES = 120;

// A file name of its own for each event, stable from one run to the next, so a link copied somewhere keeps working
export const icsPath = (key: string): string => `ics/${createHash('sha1').update(key).digest('hex').slice(0, 16)}.ics`;

// Commas, semicolons, backslashes and line breaks are escaped in a text value
const text = (value: string): string => value.replace(/[\\;,]/g, char => `\\${char}`).replace(/\r?\n/g, '\\n');

// A line is 75 octets at most, the rest on lines starting with a space; without cutting a character in two
const fold = (line: string): string => {
  const parts: string[] = [];
  let part = '';
  for (const char of line) {
    if (Buffer.byteLength(part + char) > (parts.length === 0 ? 75 : 74)) {
      parts.push(part);
      part = '';
    }
    part += char;
  }
  return [...parts, part].join('\r\n ');
};

// 20261112T193000Z: in UTC, whatever the offset the site gave
const utc = (date: Date): string =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

const dayValue = (day: string): string => day.replace(/-/g, '');

// Its start and end: whole days, the end the day after the last, or times in UTC
const span = ({ start, end }: CalendarEvent): { allDay: boolean; start: string; end: string } => {
  if (isDayOnly(start)) {
    const last = end && isDayOnly(end) && end > start ? end : start;
    return { allDay: true, start: dayValue(start), end: dayValue(addDays(last, 1)) };
  }
  const startDate = new Date(start);
  const endDate = end && !isDayOnly(end) && new Date(end) > startDate ? new Date(end) : new Date(startDate.getTime() + DEFAULT_MINUTES * 60_000);
  return { allDay: false, start: utc(startDate), end: utc(endDate) };
};

const dates = (event: CalendarEvent): string[] => {
  const { allDay, start, end } = span(event);
  return allDay ? [`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`] : [`DTSTART:${start}`, `DTEND:${end}`];
};

export const renderIcs = (event: CalendarEvent, now: Date): string =>
  `${[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//events//Autour de chez moi//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${utc(now)}`,
    ...dates(event),
    `SUMMARY:${text(event.title)}`,
    ...(event.location ? [`LOCATION:${text(event.location)}`] : []),
    `URL:${event.url}`,
    `DESCRIPTION:${text(event.url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .map(fold)
    .join('\r\n')}\r\n`;

const uid = (key: string): string => `${createHash('sha1').update(key).digest('hex')}@events`;

// An event, from its start to its end
export const eventCalendar = (event: KnownEvent): CalendarEvent => ({
  uid: uid(event.id),
  title: event.title,
  start: event.start,
  end: event.end,
  location: [event.address, event.place].filter(Boolean).join(', ') || undefined,
  url: event.url,
});

// The key of a showtime's file and calendar event
export const screeningKey = (event: KnownEvent, showing: Showing, time: string): string => `${event.id}@${showing.url}@${time}`;

// One showtime of a film, for as long as the film lasts
export const screeningCalendar = (event: KnownEvent, showing: Showing, time: string): CalendarEvent => ({
  uid: uid(screeningKey(event, showing, time)),
  title: event.title,
  start: time,
  end: new Date(new Date(time).getTime() + (event.minutes ?? DEFAULT_MINUTES) * 60_000).toISOString(),
  location: [showing.place, showing.address].filter(Boolean).join(', '),
  url: event.url,
});
