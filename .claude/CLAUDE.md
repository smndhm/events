# My preferences, in every repository

Copied by `dev-config sync` from `@dume/dev-config` into each repository, and into `~/.claude/CLAUDE.md` for a new one (see smndhm/dev-config's `ia/README.md`): change them in smndhm/dev-config, never in a repository. A repository's own instructions are in its `CLAUDE.md`, at its root.

## Starting a repository

A new repository starts with my configuration, as my other repositories have it (smndhm/events, smndhm/dzr-cron), before any code:

- `.nvmrc` (24), `package.json` with `"packageManager": "pnpm@…"`, `"prettier": "@dume/dev-config/lint/prettier"`, and the scripts `lint` (`prettier . --check && oxlint && stylelint … && dev-config sync --check`), `lint:fix`, `test`, `typecheck` and `"prepare": "dev-config hooks"`.
- `pnpm add -D @dume/dev-config` and the tools it configures, at exact versions (`pnpm-workspace.yaml`: `savePrefix: ''`, `minimumReleaseAgeExclude: ['@dume/*']`).
- `.oxlintrc.json` and `stylelint.config.mjs` extending `@dume/dev-config`'s, `.prettierignore`, `renovate.json` extending `local>smndhm/dev-config//renovate/default`.
- `pnpm exec dev-config sync`: `.claude/settings.json`, these instructions and the pre-commit hook.
- `.github/workflows/`: the tests on pull requests to `main` with `smndhm/dev-config/ci/setup`, and the Renovate branch workflow, their actions pinned to a commit.
- A README in English: what it is, how it works, how to develop it.

## Stack

Use my tools rather than new ones, as my other repositories do:

- pnpm, the Node.js of `.nvmrc`, TypeScript run as it is by Node.js (no build step), Vitest, with the sites' pages saved as test fixtures rather than calls to the sites.
- `@dume/dev-config`: Prettier, oxlint, Stylelint, the pre-commit hook, the Renovate preset, `smndhm/dev-config/ci/setup` in GitHub Actions.
- Playwright for a browser (not Puppeteer), and `@dume/dev-config/a11y` for the accessibility audits.
- GitHub Actions for what runs on a schedule, GitHub Pages for a static site.

## Interface

- Build pages with my design system, `@dume/ds` (smndhm/blu, `packages/ds`): its layouts, components, utilities and tokens.
- A page's own CSS is only what is its own: in a `.css` file, not in the HTML, checked by `@dume/dev-config`'s Stylelint configuration. Its classes are BEM, without the design system's `ds-` namespace. No element or descendant selectors.
- What another project could use goes into the design system, not into the project: propose it there, following its README's "Choosing what to add" (a native element first, then a component).
- Every size on the base 4: multiples of 4px, from the design system's tokens (`var(--ds-b-size-8)`), in rem otherwise (multiples of 0.25rem). What a size comes to counts, not how it is written: `0.5em` in 12px text is 6px, off the base. A block's height too: its line and its borders.
- Flex rather than grid for layout, unless only a grid can do it.
- What comes second is small: secondary links and marks in small print, so the title stays what one reads first.

## Standards

Prefer a standard to a provider: iCalendar rather than one calendar's links, schema.org JSON-LD rather than CSS selectors to read a site, native elements (`details`, `fieldset`, `dialog`) rather than scripts.

## Accessibility

Native elements first. A link whose text alone does not say where it goes ("20:30", "mer. 11") gets a hidden text that does, with `ds-u-visually-hidden`.

## Delivery

- Work on a branch, and open a pull request to `main`.
- Code, comments, commits, pull requests and READMEs in English; the interface in the language of its visitors.
