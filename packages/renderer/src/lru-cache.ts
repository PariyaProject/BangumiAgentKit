export class RendererLruCache<V> {
  private map = new Map<string, V>();
  private capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Cache capacity must be greater than 0');
    }
    this.capacity = capacity;
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }
    const val = this.map.get(key)!;
    // Re-insert to promote to most recently used
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Evict least recently used (first key in map iteration order)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
