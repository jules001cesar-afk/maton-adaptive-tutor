# MATON Adaptive AI Tutor

Built for the Meta Global AI Developer Hackathon 2026 (Indie Developer track, "Build for Your World").

A student photographs handwritten homework. MATON finds the exact step where the
reasoning went wrong, marks the correction on the student's own page, explains it in
Haitian Creole, and gives a new practice exercise whose math is checked by code.

All code in this repository was written during the hackathon (started Oct 26, 2026).
It is a separate project from the existing MATON platform at maton-edu.com.

## Status

Day 1: first Meta Model API tests (`scripts/test-meta.mjs`).

## Setup

1. Copy `.dev.vars.example` to `.dev.vars` and paste your Meta Model API key after `MODEL_API_KEY=`.
2. Text test: `node --env-file=.dev.vars scripts/test-meta.mjs`
3. Photo test: `node --env-file=.dev.vars scripts/test-meta.mjs test-photos/notebook.jpg`

The key is read only on the machine running the script. It is never printed or committed.
