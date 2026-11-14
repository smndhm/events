// Films in their original language, from the showtimes Allociné gives for each cinema, as JSON: one request per cinema,
// day and page of fifteen films. Foreign films in original version, subtitled or not, and French films, which are in
// French; dubbed showtimes are left out. A film is one event, from its first showtime to its last in any of the cinemas,
// with its showtimes in each cinema showing it, by day, the nearest cinema first.
import { addDays, parisDay, withParisOffset } from '../utils/dates.ts';
import { fetchPage } from '../utils/http.ts';
import { distanceKm } from '../utils/geo.ts';
import type { Event, Showing, Source } from '../types.ts';

const NAME = 'allocine';

// Allociné's answer for a day without showtimes, its next day in `nextDate`
const NO_SHOWTIMES = 'next.showtime.on';

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
  results: { movie: { internalId: number; title: string; runtime?: string | null }; showtimes: Record<string, Showtime[]> }[];
};

// ORIGINAL: a foreign film in original version, subtitled or not. LOCAL: a French film, in French. DUBBED, left out: a
// foreign film dubbed in French.
const VERSIONS = ['ORIGINAL', 'LOCAL'] as const;
type Version = (typeof VERSIONS)[number];

export type Screening = { movieId: number; title: string; startsAt: string; version: Version; minutes?: number };

// "1h 33min", or "52min": in minutes
export const parseRuntime = (runtime: string | null | undefined): number | undefined => {
  const match = runtime?.match(/^(?:(\d+)h)?\s*(?:(\d+)\s*min)?$/);
  const minutes = match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : 0;
  return minutes > 0 ? minutes : undefined;
};

// The showtimes of an answer in the film's own language
export const parseShowtimes = (answer: Answer): Screening[] => {
  // A day the cinema has published no showtimes for yet: an "error" saying when its next ones are, not a failure
  if (answer.error && answer.message === NO_SHOWTIMES) return [];
  if (answer.error) throw new Error(`Allociné answered an error: ${answer.message ?? 'no message'}`);
  return answer.results.flatMap(({ movie, showtimes }) =>
    Object.values(showtimes)
      .flat()
      .filter((showtime): showtime is Showtime & { diffusionVersion: Version } => (VERSIONS as readonly string[]).includes(showtime.diffusionVersion))
      .map(showtime => ({
        movieId: movie.internalId,
        title: movie.title,
        startsAt: withParisOffset(showtime.startsAt),
        version: showtime.diffusionVersion,
        minutes: parseRuntime(movie.runtime),
      })),
  );
};

// The page of a cinema's showtimes, or of its showtimes on a day
export const theaterUrl = (theater: Theater, day?: string): string => `https://www.allocine.fr/seance/salle_gen_csalle=${theater.id}.html${day ? `#shwt_date=${day}` : ''}`;

// A cinema's showtimes of a film, by day
export const toShowing = (theater: Theater, distance: number | undefined, times: string[]): Showing => ({
  place: theaterLabel(theater),
  address: `${theater.address}, ${theater.place}`,
  url: theaterUrl(theater),
  distance,
  days: [...Map.groupBy([...new Set(times)].toSorted(), time => parisDay(time))].map(([day, dayTimes]) => ({ day, url: theaterUrl(theater, day), times: dayTimes })),
});

// "Ti Hanok (Auray)", but not "CGR Lanester (Lanester)"
export const theaterLabel = (theater: Theater): string => (theater.name.includes(theater.place) ? theater.name : `${theater.name} (${theater.place})`);

// What a cinema shows, and how far it is
export type Programme = { theater: Theater; distance?: number; screenings: Screening[] };

// One event per film: `programmes` in the order to list them, the nearest first
export const toEvents = (showings: Programme[]): Event[] => {
  const byMovie = Map.groupBy(
    showings.flatMap(({ theater, screenings }) => screenings.map(screening => ({ theater, screening }))),
    ({ screening }) => screening.movieId,
  );
  return [...byMovie].map(([movieId, entries]) => {
    const times = entries.map(({ screening }) => screening.startsAt).toSorted();
    const programmes = showings.filter(({ theater }) => entries.some(entry => entry.theater === theater));
    const theaters = programmes.map(({ theater }) => theater);
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
      minutes: first?.minutes,
      showings: programmes.map(({ theater, distance }) =>
        toShowing(
          theater,
          distance,
          entries.filter(entry => entry.theater === theater).map(({ screening }) => screening.startsAt),
        ),
      ),
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
      const showings: Programme[] = [];
      for (const theater of byDistance) {
        const screenings: Screening[] = [];
        for (let day = 0; day < days; day++) {
          screenings.push(...(await fetchDay(theater, addDays(today, day))));
        }
        showings.push({ theater, distance: Math.round(distanceKm(home, theater)), screenings });
      }
      return toEvents(showings);
    },
  };
}
