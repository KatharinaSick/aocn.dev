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

Nothing is built yet. The stack is decided — Astro with Vue islands on Netlify, a Go API on Cloud
Run, Postgres — and written down in [AGENTS.md](AGENTS.md), but this repository currently contains
only documentation.

This README grows as things land: layout, local setup and deployment get documented once they
actually exist.
