// Many event sites describe their events for search engines, as schema.org data in JSON-LD: a far steadier thing to read
// than their HTML, which changes with every redesign. This finds them in a page.

export type JsonLdEvent = {
  '@type': string | string[];
  '@id'?: string;
  'name'?: string;
  'url'?: string;
  'startDate'?: string;
  'endDate'?: string;
  'image'?: string | string[] | { url?: string };
  'eventStatus'?: string;
  'location'?: {
    name?: string;
    address?: string | { streetAddress?: string; addressLocality?: string; postalCode?: string };
    geo?: { latitude?: number | string; longitude?: number | string };
  };
};

const SCRIPTS = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// Event, and its kinds: ScreeningEvent, MusicEvent, SocialEvent...
const isEvent = (type: unknown): boolean => (Array.isArray(type) ? type : [type]).some(t => typeof t === 'string' && t.endsWith('Event'));

// A block holds one object, an array of them, or a graph of them
const flatten = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value && typeof value === 'object' && '@graph' in value) return flatten(value['@graph']);
  return [value];
};

// A block that does not parse is skipped: a site's broken breadcrumb should not cost its events
export const readJsonLdEvents = (html: string): JsonLdEvent[] =>
  [...html.matchAll(SCRIPTS)]
    .flatMap(([, json]) => {
      try {
        return flatten(JSON.parse(json ?? ''));
      } catch {
        return [];
      }
    })
    .filter((item): item is JsonLdEvent => typeof item === 'object' && item !== null && isEvent((item as JsonLdEvent)['@type']));

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Some sites put HTML entities in their JSON-LD strings
export const decodeEntities = (text: string): string =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
