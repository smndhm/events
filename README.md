# Events

What is coming up around home: flea markets, garage sales, original version films, special events. Rebuilt every morning as a web page and RSS feeds, so the weekend is planned before it starts rather than searched for on the day.

- The page: <https://smndhm.github.io/events/>, by day, with a filter by category.
- The feeds: [`rss.xml`](https://smndhm.github.io/events/rss.xml) for everything, and one per category in [`rss/`](https://smndhm.github.io/events/rss/brocante.xml). An event is an item once, the day it appears, not again on every run.

## How it works

The [Site](.github/workflows/site.yml) workflow runs every morning, and on every push to `main`:

1. Each source of [`config.ts`](config.ts) reads its site and returns its events, all in the same shape (`Event` in [`types.ts`](types.ts)).
2. [`utils/collect.ts`](utils/collect.ts) keeps the events not over yet, starting within `horizonDays` and within `radiusKm` of `home`, as the crow flies.
3. The page and the feeds are written in `_site/` ([`render/`](render)) and deployed to GitHub Pages. The page is built with my design system, [`@dume/ds`](https://github.com/smndhm/blu/tree/main/packages/ds): its stylesheet and fonts are copied next to it, as `ds/`, and the page only adds what is its own, in [`render/page.css`](render/page.css): its filter, its days and its events, in BEM, checked by Stylelint with @dume/dev-config's configuration.
4. What was published goes to the `events-state` branch, with the day each event was first seen: it is how the feeds and the "Nouveau" mark know what is new. Next to it, the page cache ([`utils/cache.ts`](utils/cache.ts)): what a source made of each page it read, so a site of hundreds of pages is only read for those that changed.

A source that fails does not take the others down: its events of the last run are kept, the site still goes out, and the run is red so it is seen. Its summary, at the top of the run's page, says what each source gave.

## Sources

| Source                                                                        | What                                                                                      | How                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Brocabrac](https://brocabrac.fr/56/)                                         | flea markets, garage sales, Christmas markets, in the Morbihan                            | the schema.org JSON-LD of its listing pages                                                                                                                         |
| [Allociné](https://www.allocine.fr/)                                          | films in original version at CGR Lanester, Cinéville Lorient and Ti Hanok (Auray)         | the JSON of its showtimes, for the coming week: one event per film and cinema, its showtimes as details                                                             |
| [Morbihan Tourisme](https://morbihan.com/a-voir-a-faire/agenda/tout-lagenda/) | concerts, plays, shows and what the towns put on, such as the Espace Kerverh in Landévant | its sitemap, then the JSON-LD of each event page, read only when new or changed (the page cache); what lasts more than 14 days, such as weekly markets, is left out |

### Adding one

A source is one file in [`sources/`](sources), exporting a function that returns a `Source`: a name, a label and a homepage for the foot of the page, and `fetchEvents()`. Then one line in `config.ts`.

- Look for JSON-LD first: many event sites describe their events for search engines, and [`utils/json-ld.ts`](utils/json-ld.ts) reads them. It holds up far better than CSS selectors.
- An event's `id` must stay the same from one run to the next, or it is new again every morning.
- A site with a page per event: give `cache` (`fetchEvents({ now, cache })`) each page with the date it changed, as [`sources/morbihan.ts`](sources/morbihan.ts) does with its sitemap.
- A cinema on Allociné is one more line in the `theaters` of `config.ts`: its code is in the address of its page, `salle_gen_csalle=P9556`.
- Test it on a page of the site saved in [`__fixtures__`](__fixtures__), as [`sources/brocabrac.spec.ts`](sources/brocabrac.spec.ts) does: the tests never call the sites.
- A site that only shows its events with JavaScript can be read with Playwright, which is already here for the accessibility audit.

## Setup

In the repository's settings, `Pages` > `Build and deployment` > `Source`: **GitHub Actions**. Nothing else: no secret, and the first run creates the state branch.

The first run marks every event as new, there being nothing to compare it to.

## Development

```sh
pnpm install
pnpm build       # reads the real sites, writes _site/ and .state/
pnpm test        # on the pages of __fixtures__
pnpm typecheck
pnpm lint
pnpm exec playwright install chromium
pnpm test:a11y   # axe on the page, in light and dark, and its filter
```

Node runs the TypeScript files as they are, without a build ([`tsconfig.json`](tsconfig.json) keeps to the syntax it can strip).
