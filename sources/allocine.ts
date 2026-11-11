// Films in their original language, from the showtimes Allociné gives for each cinema, as JSON: one request per cinema,
// day and page of fifteen films. Foreign films in original version, subtitled or not, and French films, which are in
// French; dubbed showtimes are left out. A film is one event, from its first showtime to its last in any of the cinemas,
// each cinema showing it a line of details, the nearest first.
import { addDays, parisDay, TIME_ZONE, withParisOffset } from '../utils/dates.ts';
import { fetchPage } from '../utils/http.ts';
import { distanceKm } from '../utils/geo.ts';
import type { Event, Segment, Source } from '../types.ts';

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

// ORIGINAL: a foreign film in original version, subtitled or not. LOCAL: a French film, in French. DUBBED, left out: a
// foreign film dubbed in French.
const VERSIONS = ['ORIGINAL', 'LOCAL'] as const;
type Version = (typeof VERSIONS)[number];

export type Screening = { movieId: number; title: string; startsAt: string; version: Version };

// The showtimes of an answer in the film's own language
export const parseShowtimes = (answer: Answer): Screening[] => {
  if (answer.error) throw new Error(`Allociné answered an error: ${answer.message ?? 'no message'}`);
  return answer.results.flatMap(({ movie, showtimes }) =>
    Object.values(showtimes)
      .flat()
      .filter((showtime): showtime is Showtime & { diffusionVersion: Version } => (VERSIONS as readonly string[]).includes(showtime.diffusionVersion))
      .map(showtime => ({ movieId: movie.internalId, title: movie.title, startsAt: withParisOffset(showtime.startsAt), version: showtime.diffusionVersion })),
  );
};

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });

// The page of a cinema's showtimes, or of its showtimes on a day
export const theaterUrl = (theater: Theater, day?: string): string => `https://www.allocine.fr/seance/salle_gen_csalle=${theater.id}.html${day ? `#shwt_date=${day}` : ''}`;

// "CGR Lanester : jeu. 12 : 17:45, 21:00 · ven. 13 : 20:30", the cinema a link to its showtimes, and each day a link to
// its showtimes that day. A day and its first time are kept on one line, and the dot after a day's times with them: only
// between the times and between the days can a line break.
export const describeShowtimes = (theater: Theater, times: string[]): Segment[] => [
  { text: theaterLabel(theater), url: theaterUrl(theater), hint: 'toutes les séances' },
  { text: ' : ' },
  ...[...Map.groupBy(times.toSorted(), time => parisDay(time))].flatMap(([day, dayTimes], index) => [
    ...(index > 0 ? [{ text: '\u00a0· ' }] : []),
    { text: dayFormat.format(new Date(dayTimes[0] ?? '')).replace(' ', '\u00a0'), url: theaterUrl(theater, day), hint: `séances du jour à ${theaterLabel(theater)}` },
    { text: `\u00a0:\u00a0${dayTimes.map(time => timeFormat.format(new Date(time))).join(', ')}` },
  ]),
];

// "Ti Hanok (Auray)", but not "CGR Lanester (Lanester)"
export const theaterLabel = (theater: Theater): string => (theater.name.includes(theater.place) ? theater.name : `${theater.name} (${theater.place})`);

// One event per film: `theaters` in the order to list them, the nearest first, and what each one shows
export const toEvents = (showings: { theater: Theater; screenings: Screening[] }[]): Event[] => {
  const byMovie = Map.groupBy(
    showings.flatMap(({ theater, screenings }) => screenings.map(screening => ({ theater, screening }))),
    ({ screening }) => screening.movieId,
  );
  return [...byMovie].map(([movieId, entries]) => {
    const times = entries.map(({ screening }) => screening.startsAt).toSorted();
    const theaters = showings.map(({ theater }) => theater).filter(theater => entries.some(entry => entry.theater === theater));
    const [nearest] = theaters;
    const first = entries[0]?.screening;
    return {
      id: `${NAME}:${movieId}`,
      source: NAME,
      category: 'cinema',
      // A French film is in French: only a foreign one says it is in original version
      title: first?.version === 'ORIGINAL' ? `${first.title} (VO)` : (first?.title ?? ''),
      start: times[0] ?? '',
      end: times.at(-1),
      place: theaters.map(theaterLabel).join(', '),
      lat: nearest?.lat,
      lon: nearest?.lon,
      url: `https://www.allocine.fr/film/fichefilm_gen_cfilm=${movieId}.html`,
      details: theaters.map(theater => {
        const shown = entries.filter(entry => entry.theater === theater).map(({ screening }) => screening.startsAt);
        return describeShowtimes(theater, [...new Set(shown)]);
      }),
    };
  });
};

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

export default function allocine({ home, theaters, days }: { home: { lat: number; lon: number }; theaters: Theater[]; days: number }): Source {
  // The nearest cinema first: it gives a film its distance, and comes first under it
  const byDistance = theaters.toSorted((a, b) => distanceKm(home, a) - distanceKm(home, b));
  return {
    name: NAME,
    label: 'Allociné',
    homepage: 'https://www.allocine.fr/',
    fetchEvents: async ({ now }) => {
      const today = parisDay(now);
      const showings: { theater: Theater; screenings: Screening[] }[] = [];
      for (const theater of byDistance) {
        const screenings: Screening[] = [];
        for (let day = 0; day < days; day++) {
          screenings.push(...(await fetchDay(theater, addDays(today, day))));
        }
        showings.push({ theater, screenings });
      }
      return toEvents(showings);
    },
  };
}
