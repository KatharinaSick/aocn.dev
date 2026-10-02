# aocn.dev

The website and API for **Advent of Cloud Native** — a 24-day Cloud Native advent calendar in the
spirit of Advent of Code.

Twelve CNCF projects, two days each. Every other day starting December 1 a new door opens with a
5–10 minute maintainer interview and a hands-on challenge that takes 15–30 minutes. Each challenge
starts from something running and broken; players fix it and verify their result against a live
cluster with the `aocn` CLI.

It all tells one story: POLARIS-7, the dry AI of an Arctic research station, spends December watching a
stranded crew break everything on her cluster. Players are the station's new engineer.

The challenges and the `aocn` CLI live in their own repositories.

## Status

The website has its pre-launch pages: the landing page with the countdown to door 1, the
`how it works` man page, a 404 page and a subscribable door calendar. The email signup is in the
page but not wired up yet. The API serves only a health check, and there is no database yet. The
full stack is written down in [AGENTS.md](AGENTS.md).

```
web/    Astro site, deployed to Netlify
api/    Go service (health endpoint only)
infra/  GCP platform, managed with OpenTofu
```

## The website

The site is the station console of POLARIS-7: one monospace typeface, square corners and an aurora
behind every page. Every page is prerendered.

| Page | |
|---|---|
| `/` | Pre-launch landing: countdown to door 1, email signup, calendar subscription |
| `/how-it-works` | The man page: what the calendar is, the premise, why it matters |
| `/calendar.ics` | Every door opening as a subscribable calendar, built from the schedule |
| `/design-system` | Every design token and component, rendered live (not linked, `noindex`) |
| `404` | Not found, as a vim error |

- **The schedule** lives in `web/src/lib/doors.ts`, the only place a date may appear. It decides when
  each door opens and is covered by unit tests.
- **The design tokens** live in `web/src/styles/base.css`; `/design-system` documents them.
- **Vim keys** work on every page (`?` lists them), with an off switch in the help overlay.
- **Nothing about a door's content** is in this repository before the door opens: no project names,
  no story beyond the premise, no solutions.

## Getting started

Everything runs through [devbox](https://www.jetify.com/devbox), which pins Go, Node and OpenTofu so
nothing has to be installed globally. `gcloud` is the exception and stays a local install.

```sh
devbox shell
npm install --prefix web
devbox run web      # website on :4321
devbox run api      # API on :8080
```

| Command | Description |
|---|---|
| `devbox run web` | Astro dev server |
| `devbox run api` | Go API |
| `devbox run build` | Production build of the website: type check, tests, then the build |
| `devbox run test` | Go tests and website tests |
| `npm test --prefix web` | Website tests only (Vitest) |
| `npm run check --prefix web` | Website type check only |

### Telemetry

The API is instrumented with OpenTelemetry and configured entirely through the standard `OTEL_*`
environment variables, so no backend is named in code. With no endpoint set, spans are printed to
stdout, which is why local development needs no collector:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=https://<env>.live.dynatrace.com/api/v2/otlp \
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Api-Token <token>" \
devbox run api
```

## Deployment

The website deploys to Netlify from `web/`. Build settings live in `netlify.toml` at the repository
root rather than in the Netlify UI, so a site can be connected or recreated without dashboard setup.

`aocn.dev` is the canonical domain; `adventofcloudnative.dev` is attached to the same site and
redirects to it.

A failing website test or type error fails `npm run build`, and so the Netlify deploy: a broken
schedule never reaches production.

This README grows as things land: the API and the database get documented once they actually exist.
