# EMBERWILD — Dungeon Generator

Procedural dungeon generation from handcrafted room-kits, matching the
`src/systems/dungeon/` slot in the technical architecture doc.

## What's here
- `types.ts` — `RoomKit`, `RoomInstance`, `DungeonLayout`, config types
- `RNG.ts` — seeded deterministic RNG (mulberry32) so a dungeon can be
  regenerated from a saved seed
- `RoomKitLibrary.ts` — loads room-kit JSON and answers "which kits fit this
  slot" queries
- `DungeonGenerator.ts` — the generator itself: a constrained random walk
  decides the grid layout, then compatible room-kits get assigned to each cell
- `room-kits/exampleRoomKits.json` — 8 sample kits demonstrating the schema
- `example.ts` — runnable demo: generates a layout, prints an ASCII map, and
  asserts the result is fully connected

## How it works, in short
1. **Grid layout first, art second.** The generator decides *where* rooms go
   and how they connect purely as an abstract grid graph — no room-kit is
   chosen yet. This keeps the connectivity logic simple and testable on its
   own.
2. **Depth from the entrance drives both hazard tier and the boss location.**
   The deepest cell reached by the walk becomes the boss room; tier escalates
   every `tierScalingFactor` steps of depth, capped at `maxTier`.
3. **Room-kits are matched, not authored per-dungeon.** Each cell knows which
   directions it needs doors in; any kit whose doors are a superset of that,
   at the right tier and biome, is eligible. Extra unused doors on a kit are
   returned as `sealedDoors` so the scene builder renders them as walls.

## Verified during development
- Compiles clean under `strict` TypeScript.
- 500-trial stress test across random room counts (3–33) and random
  branch/secret probabilities: 0 failures, all layouts fully connected, no
  duplicate grid positions.
- Entrance/Boss room types are **never** silently swapped for a mismatched
  kit — if your tier/biome config can't produce a proper entrance or boss
  room, generation throws a clear error instead of shipping a room whose art
  doesn't match its role.
- `targetRoomCount < 2` is rejected outright, since a dungeon needs at least
  a distinct entrance and boss room.

## Known limitation worth knowing about
Room-kits are matched by **exact** door direction, not rotated to fit. The
example kits work around this with a few "all 4 doors" filler kits so
generation always succeeds — but as you author real kits with real tile art,
you'll likely want either (a) enough door-direction variants per kit, or
(b) a rotation step (try the kit at 0°/90°/180°/270° and rotate the tilemap
to match) added to `RoomKitLibrary.findCandidates`. Flagging this now so it
doesn't surprise you later — happy to build the rotation support when you're
ready for it.

## Dropping this into your project
Copy `src/systems/dungeon/` as-is into your existing Vite + Phaser 3 project.
`DungeonGenerator` and `RoomKitLibrary` have no Phaser dependency — they're
pure data/logic, so a `DungeonScene.ts` can call `generator.generate()` and
walk the returned `DungeonLayout.rooms` to instantiate real tilemaps and
`RoomInstance.sealedDoors` to know where to render walls instead of openings.

## Run the demo yourself
```bash
npm install --save-dev typescript
npx tsc
node dist/systems/dungeon/example.js
```
