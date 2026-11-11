// Films in original version, from the showtimes Allociné gives for each cinema, as JSON: one request per cinema, day and
// page of fifteen films. A film is one event per cinema, from its first showtime to its last, its showtimes as details.
import { addDays, parisDay, TIME_ZONE, withParisOffset } from '../utils/dates.ts';
import { fetchPage } from '../utils/http.ts';
import type { Event, Source } from '../types.ts';

const NAME = 'allocine';

export type Theater = {
  // Allociné's code, in the address of its page: allocine.fr/seance/salle_gen_csalle=P9556.html
  id: string;
  name: string;
  address: string;
  place: string;
  lat: number;
  lon: number;
};

type Showtime = { startsAt: string; diffusionVersion: string };
type Answer = {
  error: boolean;
  message?: string | null;
  pagination?: { page: number | string; totalPages: number };
  results: { movie: { internalId: number; title: string }; showtimes: Record<string, Showtime[]> }[];
};

export type Screening = { movieId: number; title: string; startsAt: string };

// The showtimes in original version, subtitled or not, of an answer. A French film is LOCAL, and a dubbed one DUBBED.
export const parseShowtimes = (answer: Answer): Screening[] => {
  if (answer.error) throw new Error(`Allociné answered an error: ${answer.message ?? 'no message'}`);
  return answer.results.flatMap(({ movie, showtimes }) =>
    Object.values(showtimes)
      .flat()
      .filter(showtime => showtime.diffusionVersion === 'ORIGINAL')
      .map(showtime => ({ movieId: movie.internalId, title: movie.title, startsAt: withParisOffset(showtime.startsAt) })),
  );
};

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });

// "jeu. 12 : 17:45, 21:00 · ven. 13 : 20:30"
export const describeShowtimes = (times: string[]): string =>
  [...Map.groupBy(times.toSorted(), time => parisDay(time))]
    // A day and its first time are kept on one line: only between the times and between the days can a line break
    .map(([, day]) => `${dayFormat.format(new Date(day[0] ?? '')).replace(' ', '\u00a0')}\u00a0:\u00a0${day.map(time => timeFormat.format(new Date(time))).join(', ')}`)
    .join(' · ');

export const toEvents = (theater: Theater, screenings: Screening[]): Event[] =>
  [...Map.groupBy(screenings, ({ movieId }) => movieId)].map(([movieId, showings]) => {
    const times = [...new Set(showings.map(({ startsAt }) => startsAt))].toSorted();
    return {
      id: `${NAME}:${theater.id}:${movieId}`,
      source: NAME,
      category: 'cinema',
      title: `${showings[0]?.title ?? ''} (VO)`,
      start: times[0] ?? '',
      end: times.at(-1),
      // "Ti Hanok, Auray", but not "CGR Lanester, Lanester"
      place: theater.name.includes(theater.place) ? theater.name : `${theater.name}, ${theater.place}`,
      address: theater.address,
      lat: theater.lat,
      lon: theater.lon,
      url: `https://www.allocine.fr/seance/salle_gen_csalle=${theater.id}.html`,
      details: describeShowtimes(times),
    };
  });

const fetchDay = async (theater: Theater, day: string): Promise<Screening[]> => {
  const screenings: Screening[] = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const { html } = await fetchPage(`https://www.allocine.fr/_/showtimes/theater-${theater.id}/d-${day}/${page > 1 ? `p-${page}/` : ''}`);
    const answer = JSON.parse(html) as Answer;
    screenings.push(...parseShowtimes(answer));
    pages = answer.pagination?.totalPages ?? 1;
  }
  return screenings;
};

export default function allocine({ theaters, days }: { theaters: Theater[]; days: number }): Source {
  return {
    name: NAME,
    label: 'Allociné',
    homepage: 'https://www.allocine.fr/',
    fetchEvents: async ({ now }) => {
      const today = parisDay(now);
      const events: Event[] = [];
      for (const theater of theaters) {
        const screenings: Screening[] = [];
        for (let day = 0; day < days; day++) {
          screenings.push(...(await fetchDay(theater, addDays(today, day))));
        }
        events.push(...toEvents(theater, screenings));
      }
      return events;
    },
  };
}
