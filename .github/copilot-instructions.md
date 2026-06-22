# Agent Instructions

This is a TypeScript plugin for Oh My Pi (omp) that registers a Command Code AI provider.

## Code Style
- TypeScript with strict mode
- ESM modules with `.js` extensions in imports (for Bun compatibility)
- Biome for linting and formatting (2-space indent, double quotes, semicolons)
- Use `unknown` over `any`; use type guards for narrowing

## Architecture
- `src/index.ts` — entry point, `streamSimple` + `registerCommandCode`
- `src/auth.ts` — API key resolution (env var, auth.json files)
- `src/config.ts` — constants (provider ID, base URL, API version)
- `src/convert.ts` — message and tool conversion between omp Context and CC wire format
- `src/models.ts` — model catalog loading from `models.json`
- `src/stream.ts` — SSE stream parsing (CC events → omp AssistantMessageEventStream)

## Testing
- `bun test` runs all tests (no external dependencies needed)
- Tests for convert.ts, stream.ts, models.ts cover the pure functions
- No API key required for tests — they use only bundled data

## Committing
- Follow conventional commits: `feat:`, `fix:`, `ci:`, `docs:`, `test:`
- Run `bun run check` before pushing (lint + test)
- The release-please bot handles version bumps and changelogs
