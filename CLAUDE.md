@AGENTS.md

## Keeping documentation current

Before ending a session that touched `package.json` scripts/dependencies, `supabase/migrations/`, `.env.example`, or added build/CI tooling, check the table in AGENTS.md's "Documentation maintenance" section and update README.md accordingly. Stale docs are a defect, not a follow-up.

## Project-scoped skills

Installed for this repo only, deliberately not at the user level — this project's owner doesn't work in Expo/React Native often enough to want these cluttering every other project.

- **`impeccable`** (`.claude/skills/impeccable/`, a raw project-local copy) — UI/UX design work: shaping a screen before building it, critique, polish, and related commands. `PRODUCT.md` and `DESIGN.md` at the repo root hold its captured product/visual context — read them before design work rather than re-deriving it. Platform is recorded as `web` (deliberately, not `adaptive`) so no native iOS HIG/Material 3 rulebook loads by default: Nordic Ice governs every platform as one uniform system, adapted to each platform's physical constraints rather than replaced by native-per-OS components. Android is the priority platform for native testing/QA — a testing-order fact only, it does not change the visual system.
- **`expo-app-design:building-native-ui`** (plugin, project scope) — navigation, styling, animations, native tabs with Expo Router. The primary reference for the Routines and Health screens that come after this foundation. Also covers native UI performance (`/impeccable audit`/`optimize` overlaps here — check `impeccable` first before reaching for a second opinion) and Tailwind/NativeWind styling patterns.
- **`expo-app-design:expo-dev-client`** (plugin, project scope) — managing the native dev build that Google OAuth requires (Expo Go can't complete the redirect).
- **`expo-app-design:native-data-fetching`** (plugin, project scope) — fetching/caching/error patterns for screens reading live Supabase data.
- **`expo-deployment:expo-deployment`** (plugin, project scope) — for when "Compilación de producción" in the README stops being a documented gap.
- **`upgrading-expo:upgrading-expo`** (plugin, project scope) — for the next Expo SDK bump; relevant here because the styling stack (`nativewind`, `react-native-css`, pinned `lightningcss`) is pre-1.0 and version-sensitive (see the `pnpm-workspace.yaml` override history).

The three `expo-plugins` marketplace plugins above were installed with `claude plugin install <name>@expo-plugins --scope project` and then removed from the user's global install (`claude plugin uninstall <name>@expo-plugins --scope user`) — they used to be enabled for every project on this machine; now only this one. `.claude/settings.json`'s `enabledPlugins` is what the CLI actually reads for project scope (confirmed by inspecting its output after the install).

## Skills considered and deliberately not installed

- **`dataviz`** and **`security-review`** — built into Claude Code, not plugins; already available with no per-project action possible or needed. `dataviz` is relevant for the weight chart (`react-native-gifted-charts`, design spec §11) when the Health plan builds it; `security-review` is worth running as a second opinion given the RLS/auth work already done, whenever that's wanted — not yet run on this repo.
- **`frontend-design`** — real overlap with `impeccable`, which already owns this project's design authority (`PRODUCT.md`/`DESIGN.md`). Two design-guidance skills active on the same repo risk conflicting direction; skip unless `impeccable` is ever removed.
- **`graphify`** — a global skill (`~/.claude/skills/graphify`), not project-scoped, so nothing to install regardless. Building a graph for this repo is a separate, deliberate step not yet taken. Assessed and declined for now: not worth it at this repo's size (~60 files); revisit once the Routines and Health plans land and a session starts needing multiple `Explore` dispatches just to orient. If one is set up later, add a rule to re-read the graph report before architecture questions and rebuild it after code changes.
- **`claude-mem`** (third-party, not in any installed marketplace) — persistent cross-session memory via automatic tool-call capture + semantic search. Declined: heavy overlap with Claude Code's native Auto Memory (on by default since v2.1.59, already in active use on this project), plus it's an unofficial marketplace and a new local vector DB to maintain, for uncertain marginal benefit at this project's current scale.
