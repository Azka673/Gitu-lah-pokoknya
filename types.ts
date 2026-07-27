/**
 * EMBERWILD — Dungeon Generator
 * Core types shared across the room-kit library and the generator itself.
 */

export enum Direction {
  North = 'N',
  East = 'E',
  South = 'S',
  West = 'W',
}

export const ALL_DIRECTIONS: Direction[] = [
  Direction.North,
  Direction.East,
  Direction.South,
  Direction.West,
];

export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case Direction.North:
      return Direction.South;
    case Direction.South:
      return Direction.North;
    case Direction.East:
      return Direction.West;
    case Direction.West:
      return Direction.East;
  }
}

/** Grid offset produced by moving one cell in the given direction. */
export function directionOffset(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case Direction.North:
      return { dx: 0, dy: -1 };
    case Direction.South:
      return { dx: 0, dy: 1 };
    case Direction.East:
      return { dx: 1, dy: 0 };
    case Direction.West:
      return { dx: -1, dy: 0 };
  }
}

export enum RoomType {
  Entrance = 'entrance',
  Combat = 'combat',
  Treasure = 'treasure',
  Secret = 'secret',
  Rest = 'rest',
  Puzzle = 'puzzle',
  Boss = 'boss',
}

/**
 * A handcrafted room piece authored by hand (art + tilemap), described here
 * only by the metadata the generator needs to place and connect it.
 */
export interface RoomKit {
  id: string;
  type: RoomType;
  /** Edges of this room that have a door opening, as authored in the source tilemap. */
  doors: Direction[];
  /** Inclusive hazard/loot tier range this kit is appropriate for. */
  minTier: number;
  maxTier: number;
  /** Biome/theme tags this kit belongs to (e.g. "volcanic_caverns"). */
  biomeTags: string[];
  /** Free-form gameplay tags (e.g. "fire_hazard", "narrow", "water"). */
  tags: string[];
  /** Key referencing the actual tilemap/asset data this kit renders from. */
  tilemapKey: string;
  /** Footprint in room-grid cells. Almost always 1x1; supports larger set-pieces. */
  width: number;
  height: number;
}

/** A RoomKit placed at a specific position in a generated dungeon. */
export interface RoomInstance {
  id: string;
  kitId: string;
  gridX: number;
  gridY: number;
  tier: number;
  type: RoomType;
  bfsDepth: number;
  /** Doors on this room that connect to a placed neighbor and should render as open. */
  openDoors: Direction[];
  /** Doors present on the kit's art but unused here — scene builder should render these sealed. */
  sealedDoors: Direction[];
}

export interface DungeonConnection {
  fromRoomId: string;
  toRoomId: string;
  direction: Direction;
}

export interface DungeonLayout {
  seed: string;
  rooms: RoomInstance[];
  entranceRoomId: string;
  bossRoomId: string;
  connections: DungeonConnection[];
}

export interface DungeonGenerationConfig {
  /** Deterministic seed. Same seed + same config + same kit library = same dungeon. */
  seed?: string | number;
  /** Roughly how many rooms to place (actual count may be lower if generation boxes itself in). */
  targetRoomCount: number;
  /** Hazard/loot tier assigned to the entrance room. */
  baseTier: number;
  /** How many BFS-depth steps from the entrance before the tier increases by 1. */
  tierScalingFactor: number;
  /** Hard ceiling on tier, regardless of depth. */
  maxTier: number;
  /** Theme tag used to filter which kits are eligible (e.g. "volcanic_caverns"). */
  biomeTag: string;
  /** 0-1 chance to branch off an older cell instead of extending the newest corridor. */
  branchProbability: number;
  /** 0-1 chance a dead-end cell becomes a Treasure/Secret room instead of Combat. */
  secretRoomChance: number;
}
