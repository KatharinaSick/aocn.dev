# aocn.dev

The website and API for **Advent of Cloud Native** — a 24-day Cloud Native advent calendar in the
spirit of Advent of Code. Twelve CNCF projects, two days each: every other door opens a maintainer
interview and a hands-on challenge, fixed against a live cluster with the `aocn` CLI. It tells one
story throughout — Pola, the dry AI of an Arctic research station, watching a stranded crew break
everything on her cluster.

The challenges and the CLI live in their own repositories. [AGENTS.md](AGENTS.md) has the full
picture: format, stack and conventions.

Early scaffolding. The website is a placeholder page, the API serves a health check, and there is no
database yet.

```
web/    Astro site, deployed to Netlify
api/    Go service, deployed to Cloud Run
infra/  GCP platform, managed with OpenTofu
```

## Getting started

[devbox](https://www.jetify.com/devbox) pins Go, Node and OpenTofu.

```sh
devbox shell
npm install --prefix web
```

| Command | |
|---|---|
| `devbox run web` | Astro dev server on `:4321` |
| `devbox run api` | Go API on `:8080` |
| `devbox run build` | Production build of the website, and checks the API compiles |
| `devbox run test` | Every test in the repository |

The API is instrumented with OpenTelemetry and configured through the standard `OTEL_*` variables, so
no backend is named in code. With nothing set, spans go to stdout and local development needs no
collector.

## Deployment

Both halves deploy from `main`, and neither is configured in a dashboard. The website goes to Netlify
from `web/`, where `aocn.dev` is canonical and `adventofcloudnative.dev` redirects to it. The API runs
on Cloud Run, and `netlify.toml` proxies `/api/*` to it so the browser only ever talks to `aocn.dev`.

[infra/](infra/README.md) describes the platform underneath.
