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

Early scaffolding. The website is a placeholder page; there is no API, no database and no
deployment yet. The full stack is decided and written down in [AGENTS.md](AGENTS.md).

```
web/    Astro site, deployed to Netlify (placeholder page only)
```

## Getting started

Everything runs through [devbox](https://www.jetify.com/devbox), which pins Go and Node so nothing
has to be installed globally.

```sh
devbox shell
npm install --prefix web
devbox run web      # website on :4321
```

| Command | Description |
|---|---|
| `devbox run web` | Astro dev server |
| `devbox run build` | Production build of the website |

## Deployment

The website deploys to Netlify from `web/`. Build settings live in `netlify.toml` at the repository
root rather than in the Netlify UI, so a site can be connected or recreated without dashboard setup.

`aocn.dev` is the canonical domain; `adventofcloudnative.dev` is attached to the same site and
redirects to it.

This README grows as things land: the API and the database get documented once they actually exist.
