@AGENTS.md

## Keeping documentation current

Before ending a session that touched `package.json` scripts/dependencies, `supabase/migrations/`, `.env.example`, or added build/CI tooling, check the table in AGENTS.md's "Documentation maintenance" section and update README.md accordingly. Stale docs are a defect, not a follow-up.

## Project-scoped skills

- **`impeccable`** (`.claude/skills/impeccable/`) — UI/UX design work: shaping a screen before building it, critique, polish, and related commands. `PRODUCT.md` and `DESIGN.md` at the repo root hold its captured product/visual context — read them before design work rather than re-deriving it. Platform is recorded as `web` (deliberately, not `adaptive`) so no native iOS HIG/Material 3 rulebook loads by default: Nordic Ice governs every platform as one uniform system, adapted to each platform's physical constraints rather than replaced by native-per-OS components. Android is the priority platform for native testing/QA — a testing-order fact only, it does not change the visual system.

A `graphify` knowledge graph is not set up for this repo; if one ever is, add the same read-before-architecture-questions rule the sibling `one-ui/` project uses.
