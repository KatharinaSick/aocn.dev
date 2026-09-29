# aocn.dev

The website and API for **Advent of Cloud Native** — a 24-day Cloud Native advent calendar in the
spirit of Advent of Code.

Twelve CNCF projects, two days each. Every other day starting December 1 a new door opens with a
5–10 minute maintainer interview and a hands-on challenge that takes 15–30 minutes. Each challenge
starts from something running and broken; players fix it and verify their result against a live
cluster with the `aocn` CLI.

It all tells one story: Pola, the dry AI of an Arctic research station, spends December watching a
stranded crew break everything on her cluster. Players are the station's new engineer.

The challenges and the `aocn` CLI live in their own repositories.

## Status

Early scaffolding. The website is a placeholder page and the API serves only a health check.
There is no database yet. The full stack is decided and written down in [AGENTS.md](AGENTS.md).

```
web/    Astro site, deployed to Netlify (placeholder page only)
api/    Go service (health endpoint only)
infra/  GCP platform, managed with OpenTofu
```

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
| `devbox run build` | Production build of the website |
| `devbox run test` | Go tests |

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

This README grows as things land: the API and the database get documented once they actually exist.
