/**
 * Deterministic, seedable RNG. Same seed always produces the same sequence,
 * which is what lets a dungeon be regenerated from a saved seed, shared,
 * or replayed for debugging.
 */

/** FNV-1a string hash, used to turn a string seed into a numeric one. */
function hashStringToSeed(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class SeededRNG {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'string' ? hashStringToSeed(seed) : seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9; // avoid a zero state, which mulberry32 can't escape
  }

  /** mulberry32 — small, fast, decent-quality PRNG. Returns a float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max), i.e. max is exclusive. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  /** True with the given probability (0-1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick one random element from a non-empty array. */
  pick<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error('SeededRNG.pick called with an empty array');
    }
    return arr[this.nextInt(0, arr.length)];
  }

  /** Fisher-Yates shuffle, returns a new array (does not mutate the input). */
  shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
