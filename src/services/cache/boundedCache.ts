interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  insertedAt: number;
}

export interface CacheHit<T> {
  hit: true;
  value: T;
  age: number;
}

export interface CacheMiss {
  hit: false;
}

export type CacheLookup<T> = CacheHit<T> | CacheMiss;

/**
 * A small LRU cache with per-entry TTL. Instances live for the browser session
 * and are intentionally bounded so long explorations do not grow memory forever.
 */
export class BoundedCache<T = unknown> {
  private readonly map = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly maxEntries = 120,
    private readonly defaultTtlMs = 5 * 60 * 1000,
  ) {}

  get(key: string): CacheLookup<T> {
    const entry = this.map.get(key);
    if (!entry) return { hit: false };
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return { hit: false };
    }
    // Refresh insertion order for LRU behavior.
    this.map.delete(key);
    this.map.set(key, entry);
    return { hit: true, value: entry.value, age: Date.now() - entry.insertedAt };
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, {
      value,
      expiresAt: Number.isFinite(ttlMs) ? Date.now() + ttlMs : Number.MAX_SAFE_INTEGER,
      insertedAt: Date.now(),
    });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
