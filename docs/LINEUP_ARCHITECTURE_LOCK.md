# Zedek Sports Lineup Architecture — Protected / Frozen

**Status:** FROZEN. Do not change lineup positioning, pitch proportions, player-card layout, slot mapping, or lineup-specific CSS without the user's explicit, direct authorization for that exact change.

## Current approved baseline

- Public live-match lineup is the FotMob-style fixed-slot pitch in `app/matches/[id]/LiveMatchCentre.js`.
- The submitted formation determines the 11 fixed positional slots. Curated formations use `FORMATION_COORDINATES`; other valid formations use `generatedFormationCoordinates()`.
- All formations pass through the shared `formationSlots()` normalization and spacing rules. Do not add formation-specific exceptions unless explicitly authorized.
- Goalkeeper normalized Y is **94** for the home team; the away team mirrors it to **6** with `100 - homeY`. This is the currently approved keeper depth.
- Current horizontal spacing multipliers: midfield roles **1.32**, centre-backs **1.38**, other roles **1.12**, clamped to the pitch bounds.
- Fixed slots, not player names, shirt numbers, card dimensions, or array order, determine player positions.
- Player cards remain children of fixed slots; the away formation mirrors vertically across the halfway line.

## Protected behavior — preserve exactly

- Goalkeeper depth and its relationship to the centre-back line.
- Formation row spacing, horizontal spread, pitch aspect ratio and pitch boundaries.
- Position-to-slot matching, duplicate-position handling, and safe legacy-data fallback.
- Mobile player-card sizing and readable identity labels.
- Goal/assist details, substitutions, yellow/red-card indicators, captain and rating markers.
- Substitute layer, its alignment, and all other live-match functionality.

## Required checks before any future authorized lineup change

1. Check every curated formation in `FORMATION_COORDINATES` and representative valid generated formations.
2. Check both home and mirrored away lineups.
3. Check desktop and narrow mobile widths.
4. Confirm exactly 11 occupied starter slots when 11 starters are supplied; no slot drift or unintended row overlap.
5. Confirm goalkeeper position is consistent across formations, inside the intended goal-area region, visible within the pitch, and clearly separated from centre-backs.
6. Confirm outer player cards and labels are not clipped or crowded.
7. Confirm event indicators, substitution markers, player links, and the substitute layer remain intact.
8. Build and inspect a preview before any production release; never infer visual correctness from a successful build alone.

## Change-control rule

Treat the lineup architecture and its associated styles as read-only by default. For unrelated tasks, do not edit these functions or lineup-specific CSS. If a task appears to require touching them, stop and ask the user before making that change. Do not merge or deploy a lineup change to production without explicit authorization.
