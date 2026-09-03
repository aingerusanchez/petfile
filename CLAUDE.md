@AGENTS.md

## Keeping documentation current

Before ending a session that touched `package.json` scripts/dependencies, `supabase/migrations/`, `.env.example`, or added build/CI tooling, check the table in AGENTS.md's "Documentation maintenance" section and update README.md accordingly. Stale docs are a defect, not a follow-up.

## Project-scoped skills

- **`impeccable`** (`.claude/skills/impeccable/`) — UI/UX design work: shaping a screen before building it, critique, polish, and related commands. `PRODUCT.md` at the repo root holds its captured product context (users, purpose, positioning, principles); read it before design work rather than re-deriving it. No `DESIGN.md` exists yet — the current Nordic Ice implementation is the incumbent visual authority until one is written (`/impeccable document` records it explicitly). Platform is recorded as `adaptive` (loads both iOS HIG and Material 3 guidance) — note this is currently in tension with the app's actual approach of one uniform custom design system across platforms rather than native-per-OS components; resolve that deliberately the first time a design command surfaces it, don't let it default silently.

A `graphify` knowledge graph is not set up for this repo; if one ever is, add the same read-before-architecture-questions rule the sibling `one-ui/` project uses.
