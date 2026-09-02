@AGENTS.md

## Keeping documentation current

Before ending a session that touched `package.json` scripts/dependencies, `supabase/migrations/`, `.env.example`, or added build/CI tooling, check the table in AGENTS.md's "Documentation maintenance" section and update README.md accordingly. Stale docs are a defect, not a follow-up.

## Project-scoped skills

No project-scoped skills are configured in `.claude/skills/` for Petlife yet. If one is added later (for example, copying `impeccable` from the sibling `one-ui/` project for UI design work, per the design spec's decision to integrate it manually — see `docs/superpowers/specs/2026-09-02-petlife-design.md` section 11), list it here with what it's for, so a future session knows it exists without rediscovering it. A `graphify` knowledge graph is not set up for this repo; if one ever is, add the same read-before-architecture-questions rule the sibling `one-ui/` project uses.
