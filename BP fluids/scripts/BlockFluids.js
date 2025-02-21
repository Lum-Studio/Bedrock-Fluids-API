import { system  } from "@minecraft/server";

export { neighborUpdate }

//Neighbor update class
class NeighborUpdate {
  /**
   * @param {object} system - The system instance (from @minecraft/server)
   * @param {object} world - The world object (or dimension) from @minecraft/server.
   * @param {number} [scanInterval=10] - Tick interval between scans.
   * @param {number} [debounceTicks=2] - Minimum ticks between re-querying the same coordinate.
   */
  constructor(system, world, scanInterval = 10, debounceTicks = 2) {
    this.system = system;
    this.world = world;
    this.scanInterval = scanInterval;
    this.debounceTicks = debounceTicks;
    // Each watcher: { pos, neighbors, cache: Map<coordKey, { type, lastUpdated }>, callback }
    this.watchers = new Set();
    // Global cache for neighbor queries: Map<coordKey, { pos, type, lastUpdated }>
    this.globalCache = new Map();
    // Start periodic scanning
    this.system.runInterval(() => this.scanAll(), scanInterval);
  }

  /**
   * Registers a block position to watch.
   * @param {object} pos - The block position to watch, e.g. {x, y, z}.
   * @param {function} callback - Called when any neighbor changes; signature: callback(changedPos, newType, oldType).
   * @returns {object} The watcher object (for later removal).
   */
  addWatcher(pos, callback) {
    const neighbors = this.getNeighbors(pos);
    const cache = new Map();
    for (const nPos of neighbors) {
      const key = this.coordKey(nPos);
      let entry = this.globalCache.get(key);
      if (!entry) {
        const block = this.world.getBlock(nPos);
        const typeId = block ? block.typeId : null;
        entry = { pos: nPos, type: typeId, lastUpdated: Date.now() };
        this.globalCache.set(key, entry);
      }
      cache.set(key, { type: entry.type, lastUpdated: entry.lastUpdated });
    }
    const watcher = { pos, neighbors, cache, callback };
    this.watchers.add(watcher);
    return watcher;
  }

  /**
   * Removes a watcher.
   * @param {object} watcher - The watcher object returned by addWatcher.
   */
  removeWatcher(watcher) {
    this.watchers.delete(watcher);
  }

  /**
   * Returns the 6 face-adjacent neighbor positions for a block.
   * @param {object} pos - The position {x, y, z}.
   * @returns {object[]} Array of neighbor positions.
   */
  getNeighbors(pos) {
    const offsets = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 }
    ];
    return offsets.map(off => ({
      x: pos.x + off.x,
      y: pos.y + off.y,
      z: pos.z + off.z
    }));
  }

  /**
   * Converts a position to a unique string key.
   * @param {object} pos - The position {x, y, z}.
   * @returns {string} e.g. "10,64,10"
   */
  coordKey(pos) {
    return `${pos.x},${pos.y},${pos.z}`;
  }

  /**
   * Performs a batched scan for neighbor changes using internal memoization.
   */
  scanAll() {
    const now = Date.now();
    // Map of coordinate key => array of { watcher, oldEntry }
    const coordToWatchers = new Map();

    // Aggregate neighbor coordinates from all watchers.
    for (const watcher of this.watchers) {
      for (const nPos of watcher.neighbors) {
        const key = this.coordKey(nPos);
        if (!coordToWatchers.has(key)) {
          coordToWatchers.set(key, []);
        }
        const oldEntry = watcher.cache.get(key);
        coordToWatchers.get(key).push({ watcher, oldEntry });
      }
    }
    // Process each unique coordinate.
    for (const [key, watcherEntries] of coordToWatchers) {
      let globalEntry = this.globalCache.get(key);
      // If recently updated (approx 50ms per tick), skip re-query.
      if (!globalEntry || (now - globalEntry.lastUpdated) >= (this.debounceTicks * 50)) {
        const pos = watcherEntries[0].watcher.neighbors.find(nPos => this.coordKey(nPos) === key);
        const block = this.world.getBlock(pos);
        const newType = block ? block.typeId : null;
        globalEntry = { pos, type: newType, lastUpdated: now };
        this.globalCache.set(key, globalEntry);
      }
      // Update each watcher for this coordinate.
      for (const { watcher, oldEntry } of watcherEntries) {
        const cached = watcher.cache.get(key);
        if (cached.type !== globalEntry.type) {
          watcher.cache.set(key, { type: globalEntry.type, lastUpdated: globalEntry.lastUpdated });
          try {
            watcher.callback(globalEntry.pos, globalEntry.type, cached.type);
          } catch (e) {
            console.error("NeighborWatcher callback error:", e);
          }
        }
      }
    }
  }
}

const neighborUpdate = new NeighborUpdate()