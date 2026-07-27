import { RoomKit, RoomType, Direction } from './types';

export interface RoomKitQuery {
  /** If omitted, kits of any type are eligible. */
  type?: RoomType;
  /** Every direction here must have a door on the candidate kit. */
  requiredDoors: Direction[];
  tier: number;
  biomeTag: string;
}

/**
 * Holds every authored RoomKit and answers "which kits could fill this slot"
 * queries for the generator. Keeping this separate from DungeonGenerator means
 * new kits can be added purely as data, with no code changes.
 */
export class RoomKitLibrary {
  private kits: RoomKit[];

  constructor(kits: RoomKit[]) {
    this.kits = kits;
  }

  /** Load a library from a JSON array (e.g. fetched from /data/dungeons/room-kits/*.json). */
  static fromJson(json: unknown): RoomKitLibrary {
    if (!Array.isArray(json)) {
      throw new Error('RoomKitLibrary.fromJson expected an array of RoomKit objects');
    }
    return new RoomKitLibrary(json as RoomKit[]);
  }

  get size(): number {
    return this.kits.length;
  }

  /**
   * Returns every kit that could legally fill a dungeon cell with the given
   * requirements. A kit qualifies if its door set is a *superset* of the
   * required doors (extra doors are fine — they get sealed at placement time),
   * its tier range covers the requested tier, and it carries the requested
   * biome tag (or is tagged "universal").
   */
  findCandidates(query: RoomKitQuery): RoomKit[] {
    return this.kits.filter((kit) => {
      if (query.type !== undefined && kit.type !== query.type) return false;
      if (kit.minTier > query.tier || kit.maxTier < query.tier) return false;
      if (!kit.biomeTags.includes(query.biomeTag) && !kit.biomeTags.includes('universal')) {
        return false;
      }
      return query.requiredDoors.every((d) => kit.doors.includes(d));
    });
  }
}
