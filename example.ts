import { DungeonGenerator } from './DungeonGenerator';
import { RoomKitLibrary } from './RoomKitLibrary';
import { DungeonLayout, RoomType } from './types';
import exampleKits from './room-kits/exampleRoomKits.json';

const ROOM_TYPE_GLYPH: Record<RoomType, string> = {
  [RoomType.Entrance]: 'E',
  [RoomType.Combat]: '.',
  [RoomType.Treasure]: 'T',
  [RoomType.Secret]: 'S',
  [RoomType.Rest]: 'R',
  [RoomType.Puzzle]: 'P',
  [RoomType.Boss]: 'B',
};

function renderLayoutAscii(layout: DungeonLayout): string {
  const xs = layout.rooms.map((r) => r.gridX);
  const ys = layout.rooms.map((r) => r.gridY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const byCoord = new Map(layout.rooms.map((r) => [`${r.gridX},${r.gridY}`, r]));
  const lines: string[] = [];

  for (let y = minY; y <= maxY; y++) {
    let line = '';
    for (let x = minX; x <= maxX; x++) {
      const room = byCoord.get(`${x},${y}`);
      line += room ? ROOM_TYPE_GLYPH[room.type] : ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** Every room must be reachable from the entrance — a disconnected layout is a generation bug. */
function assertFullyConnected(layout: DungeonLayout): void {
  const adjacency = new Map<string, string[]>();
  for (const room of layout.rooms) adjacency.set(room.id, []);
  for (const conn of layout.connections) {
    adjacency.get(conn.fromRoomId)!.push(conn.toRoomId);
    adjacency.get(conn.toRoomId)!.push(conn.fromRoomId);
  }

  const visited = new Set<string>([layout.entranceRoomId]);
  const queue = [layout.entranceRoomId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  if (visited.size !== layout.rooms.length) {
    throw new Error(
      `Layout is not fully connected: reached ${visited.size}/${layout.rooms.length} rooms from the entrance.`
    );
  }
}

function main(): void {
  const library = RoomKitLibrary.fromJson(exampleKits);

  const generator = new DungeonGenerator(library, {
    seed: 'emberwild-demo-001',
    targetRoomCount: 14,
    baseTier: 0,
    tierScalingFactor: 2,
    maxTier: 3,
    biomeTag: 'volcanic_caverns',
    branchProbability: 0.35,
    secretRoomChance: 0.4,
  });

  const layout = generator.generate();
  assertFullyConnected(layout);

  console.log(`Generated ${layout.rooms.length} rooms (seed: ${layout.seed})\n`);
  console.log(renderLayoutAscii(layout));
  console.log('\nEntrance:', layout.entranceRoomId, '| Boss:', layout.bossRoomId);
  console.log('\nRoom detail:');
  for (const room of layout.rooms) {
    console.log(
      `  ${room.id.padEnd(12)} kit=${room.kitId.padEnd(22)} type=${room.type.padEnd(9)} tier=${room.tier} depth=${room.bfsDepth} open=[${room.openDoors.join(',')}] sealed=[${room.sealedDoors.join(',')}]`
    );
  }
}

main();
