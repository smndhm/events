import { describe, expect, it } from 'vitest';
import { decodeEntities, readJsonLdEvents } from './json-ld.ts';

const script = (json: string): string => `<script type="application/ld+json">${json}</script>`;

describe('readJsonLdEvents', () => {
  it('keeps events and their kinds, from objects, arrays and graphs', () => {
    const html = [
      script('{"@type":"WebSite","name":"Site"}'),
      script('{"@type":"Event","name":"A"}'),
      script('[{"@type":"ScreeningEvent","name":"B"},{"@type":"Place"}]'),
      script('{"@graph":[{"@type":["Thing","MusicEvent"],"name":"C"}]}'),
    ].join('');
    expect(readJsonLdEvents(html).map(event => event.name)).toEqual(['A', 'B', 'C']);
  });

  it('skips a block that does not parse', () => {
    expect(readJsonLdEvents(script('{broken') + script('{"@type":"Event","name":"A"}'))).toHaveLength(1);
  });
});

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Puces &amp; troc &#233;t&#xE9; &unknown;')).toBe('Puces & troc été &unknown;');
  });
});
