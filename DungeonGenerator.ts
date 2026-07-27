import {
  ALL_DIRECTIONS,
  Direction,
  DungeonConnection,
  DungeonGenerationConfig,
  DungeonLayout,
  RoomInstance,
  RoomType,
  directionOffset,
  oppositeDirection,
} from './types';
import { RoomKitLibrary } from './RoomKitLibrary';
import { SeededRNG } from './RNG';

/** Internal working representation of one cell before a RoomKit is assigned to it. */
interface GridCell {
  x: number;
  y: number;
  /** Directions in which this cell connects to a placed neighbor. */
  connections: Set<Direction>;
  /** Steps from the entrance along the generation walk (used for tier + boss placement). */
  bfsDepth: number;
}

const cellKey = (x: number, y: number): string => `${x},${y}`;
const roomIdForCell = (x: number, y: number): string => `room_${x}_${y}`;

export class DungeonGenerator {
  private readonly rng: SeededRNG;

  constructor(
    private readonly library: RoomKitLibrary,
    private readonly config: DungeonGenerationConfig
  ) {
    this.rng = new SeededRNG(config.seed ?? Date.now());
  }

  generate(): DungeonLayout {
    if (this.config.targetRoomCount < 2) {
      throw new Error(
        `targetRoomCount must be at least 2 (an entrance and a boss room). Got ${this.config.targetRoomCount}.`
      );
    }
    const cells = this.buildGridLayout();
    if (cells.size < 2) {
      throw new Error(
        'Generation boxed itself in before placing a second room, so no distinct boss room exists. Retry with a different seed or a smaller targetRoomCount relative to branchProbability.'
      );
    }
    return this.assignRoomKits(cells);
  }

  /**
   * Step 1: decide *where* rooms go and how they connect, ignoring room art
   * entirely. A constrained random walk starting at the entrance: each step
   * either extends the newest corridor (favoring a long critical path, good
   * for pacing toward a boss) or branches off an earlier cell (favoring
   * side content like treasure/secret rooms), governed by branchProbability.
   */
  private buildGridLayout(): Map<string, GridCell> {
    const cells = new Map<string, GridCell>();
    const start: GridCell = { x: 0, y: 0, connections: new Set(), bfsDepth: 0 };
    cells.set(cellKey(0, 0), start);

    const frontier: GridCell[] = [start];

    while (cells.size < this.config.targetRoomCount && frontier.length > 0) {
      const branching = this.rng.chance(this.config.branchProbability);
      const index = branching ? this.rng.nextInt(0, frontier.length) : frontier.length - 1;
      const current = frontier[index];

      const shuffledDirections = this.rng.shuffle(ALL_DIRECTIONS);
      let expanded = false;

      for (const dir of shuffledDirections) {
        const { dx, dy } = directionOffset(dir);
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = cellKey(nx, ny);
        if (cells.has(key)) continue; // no overlaps, no trivial loops

        const next: GridCell = {
          x: nx,
          y: ny,
          connections: new Set([oppositeDirection(dir)]),
          bfsDepth: current.bfsDepth + 1,
        };
        current.connections.add(dir);
        cells.set(key, next);
        frontier.push(next);
        expanded = true;
        break;
      }

      if (!expanded) {
        // This cell is boxed in on all sides (or all neighbors are taken) — retire it.
        frontier.splice(index, 1);
      }
    }

    if (cells.size < this.config.targetRoomCount) {
      // Not a hard failure — a smaller-than-requested dungeon is still valid —
      // but worth surfacing so a caller can retry with a different seed if they want exact counts.
      // eslint-disable-next-line no-console
      console.warn(
        `DungeonGenerator: only placed ${cells.size}/${this.config.targetRoomCount} rooms before the layout boxed itself in.`
      );
    }

    return cells;
  }

  /**
   * Step 2: for every cell in the layout, pick a RoomKit whose doors satisfy
   * that cell's required connections, at a tier appropriate for its depth,
   * in the requested biome. Entrance and the deepest cell get their special
   * types; a fraction of dead ends become Treasure/Secret rooms.
   */
  private assignRoomKits(cells: Map<string, GridCell>): DungeonLayout {
    const cellList = Array.from(cells.values());
    const entranceCell = cells.get(cellKey(0, 0))!;

    const maxDepth = Math.max(...cellList.map((c) => c.bfsDepth));
    const deepestCells = cellList.filter((c) => c.bfsDepth === maxDepth);
    const bossCell = this.rng.pick(deepestCells);

    const rooms: RoomInstance[] = [];

    for (const cell of cellList) {
      const tier = Math.min(
        this.config.baseTier + Math.floor(cell.bfsDepth / this.config.tierScalingFactor),
        this.config.maxTier
      );

      const type = this.pickRoomType(cell, entranceCell, bossCell);
      const requiredDoors = Array.from(cell.connections);

      let candidates = this.library.findCandidates({
        type,
        requiredDoors,
        tier,
        biomeTag: this.config.biomeTag,
      });

      const typeIsStructural = type === RoomType.Entrance || type === RoomType.Boss;

      if (candidates.length === 0 && !typeIsStructural) {
        // Relax the type constraint before giving up — a generic combat-shaped
        // kit with the right doors is a reasonable fallback for flavor rooms.
        // Entrance/Boss are never relaxed this way: silently swapping in a
        // combat kit for the entrance would produce a room whose art and
        // tilemap don't match its logical role, which is worse than failing loudly.
        candidates = this.library.findCandidates({
          requiredDoors,
          tier,
          biomeTag: this.config.biomeTag,
        });
      }

      if (candidates.length === 0) {
        throw new Error(
          `No RoomKit satisfies cell (${cell.x},${cell.y}): needs doors [${requiredDoors.join(
            ', '
          )}] at tier ${tier} in biome "${this.config.biomeTag}". Author more kits or widen tier ranges.`
        );
      }

      const kit = this.rng.pick(candidates);
      const sealedDoors = kit.doors.filter((d) => !cell.connections.has(d));

      rooms.push({
        id: roomIdForCell(cell.x, cell.y),
        kitId: kit.id,
        gridX: cell.x,
        gridY: cell.y,
        tier,
        type,
        bfsDepth: cell.bfsDepth,
        openDoors: requiredDoors,
        sealedDoors,
      });
    }

    return {
      seed: String(this.config.seed ?? ''),
      rooms,
      entranceRoomId: roomIdForCell(entranceCell.x, entranceCell.y),
      bossRoomId: roomIdForCell(bossCell.x, bossCell.y),
      connections: this.buildConnectionList(cellList),
    };
  }

  private pickRoomType(cell: GridCell, entranceCell: GridCell, bossCell: GridCell): RoomType {
    if (cell === entranceCell) return RoomType.Entrance;
    if (cell === bossCell) return RoomType.Boss;

    const isDeadEnd = cell.connections.size === 1;
    if (isDeadEnd && this.rng.chance(this.config.secretRoomChance)) {
      return this.rng.chance(0.5) ? RoomType.Treasure : RoomType.Secret;
    }
    return RoomType.Combat;
  }

  /** Builds a de-duplicated list of edges (each connection appears once, not once per direction). */
  private buildConnectionList(cellList: GridCell[]): DungeonConnection[] {
    const connections: DungeonConnection[] = [];
    const seenEdges = new Set<string>();

    for (const cell of cellList) {
      for (const dir of cell.connections) {
        const { dx, dy } = directionOffset(dir);
        const fromId = roomIdForCell(cell.x, cell.y);
        const toId = roomIdForCell(cell.x + dx, cell.y + dy);
        const edgeKey = [fromId, toId].sort().join('|');
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);
        connections.push({ fromRoomId: fromId, toRoomId: toId, direction: dir });
      }
    }

    return connections;
  }
}
