import { world, system } from "@minecraft/server";

const FLUIDS = {
  // Use WeakMap so that when blocks are removed, state is garbage-collected.
  _stateStore: new WeakMap(),
  _dormantRegistry: new WeakMap(),
  // Fluid thresholds for determining fluid_state from fluidLevel.
  _fluidThresholds: [
    { threshold: 0.875, state: "full" },
    { threshold: 0.75,  state: "flowing_0" },
    { threshold: 0.625, state: "flowing_1" },
    { threshold: 0.5,   state: "flowing_2" },
    { threshold: 0.375, state: "flowing_3" },
    { threshold: 0.25,  state: "flowing_4" },
    { threshold: 0.125, state: "flowing_5" },
    { threshold: 0,     state: "empty" }
  ],
  // Only full blocks are allowed to go dormant.
  _dormantFluidState: "full",
  // Player proximity radius squared.
  _proximityRadiusSq: 100, // 10 blocks radius

  /**
   * Registers a fluid type.
   * Example: FLUIDS.register("cosmos:oil", { decayRate: 0.005, dormantThreshold: 0.1, stableTicksRequired: 40 });
   */
  register(fluidId, config = {}) {
    this._registrations = this._registrations || new Map();
    this._registrations.set(fluidId, {
      decayRate: config.decayRate || 0.005,
      dormantThreshold: config.dormantThreshold || 0.1,
      stableTicksRequired: config.stableTicksRequired || 40
    });
  },

  /**
   * Registers a bucket for the given fluid.
   * This function derives the empty bucket and filled bucket identifiers from fluidId.
   * For example, FLUIDS.registerBucket("cosmos:oil") will use "cosmos:oil_bucket" as the empty bucket
   * and "cosmos:oil_bucket_filled" as the filled bucket.
   */
  registerBucket(fluidId) {
    const emptyBucketId = fluidId + "_bucket";
    const filledBucketId = fluidId + "_bucket_filled";
    world.beforeEvents.worldInitialize.subscribe(({ itemComponentRegistry }) => {
      itemComponentRegistry.registerCustomComponent(emptyBucketId, {
        onUse({ source: player, itemStack }) {
          const targetBlock = player.getBlockFromViewDirection();
          if (!targetBlock) return;
          // Allow bucket use only if target is active and full OR dormant.
          const key = FLUIDS._getBlockKey(targetBlock);
          const activeState = FLUIDS._stateStore.get(targetBlock);
          if (
            (targetBlock.matches(fluidId) &&
              activeState &&
              activeState.fluidState === "full") ||
            targetBlock.matches(`${fluidId}_dormant`)
          ) {
            targetBlock.setType("minecraft:air");
            itemStack.typeId = filledBucketId;
            player.dimension.playSound("random.bucket.fill", player.location);
          }
        }
      });
    });
  },

  /**
   * Initializes the fluid components for all registered fluids.
   */
  init() {
    world.beforeEvents.worldInitialize.subscribe(({ blockComponentRegistry }) => {
      for (const [fluidId, cfg] of this._registrations.entries()) {
        // Active fluid component.
        blockComponentRegistry.registerCustomComponent(fluidId, {
          onPlace(event) {
            const block = event.block;
            FLUIDS._stateStore.set(block, {
              fluidLevel: 1.0,
              stableTicks: 0,
              fluidState: "full",
              slope: "none"
            });
            block.setPermutation({ fluid_state: "full", slope: "none" });
          },
          onTick(event) {
            const block = event.block;
            // Only update if a player is nearby.
            if (!FLUIDS._isPlayerNearby(block)) return;
            if (!FLUIDS._stateStore.has(block)) return;
            let state = FLUIDS._stateStore.get(block);
            const { decayRate, dormantThreshold, stableTicksRequired } = cfg;
            // Decay the fluid level.
            const newLevel = Math.max(0, state.fluidLevel - decayRate);
            const newStableTicks = Math.abs(newLevel - state.fluidLevel) < 0.001 ? state.stableTicks + 1 : 0;
            state.fluidLevel = newLevel;
            state.stableTicks = newStableTicks;
            // Determine fluid state dynamically.
            let newFluidState = "empty";
            for (const { threshold, state: fs } of FLUIDS._fluidThresholds) {
              if (newLevel >= threshold) {
                newFluidState = fs;
                break;
              }
            }
            state.fluidState = newFluidState;
            // Compute slope based on neighbor fluid levels.
            const slope = FLUIDS._computeSlope(block);
            state.slope = slope;
            FLUIDS._stateStore.set(block, state);
            // Update block permutation; this links to the precomputed geometry.
            block.setPermutation({ fluid_state: newFluidState, slope: slope });
            // Only allow dormant switch for a full block.
            if (
              newFluidState === FLUIDS._dormantFluidState &&
              newLevel <= dormantThreshold &&
              newStableTicks >= stableTicksRequired
            ) {
              block.setType(`${fluidId}_dormant`);
              FLUIDS._stateStore.delete(block);
              FLUIDS._dormantRegistry.set(block, fluidId);
            }
          },
          onPlayerDestroy(event) {
            const block = event.block;
            FLUIDS._stateStore.delete(block);
            FLUIDS._dormantRegistry.delete(block);
          }
        });
        // Dormant fluid component.
        blockComponentRegistry.registerCustomComponent(`${fluidId}_dormant`, {
          onPlace(event) {
            const block = event.block;
            block.setPermutation({ fluid_state: "dormant", slope: "none" });
            FLUIDS._dormantRegistry.set(block, fluidId);
          },
          // Instead of a constant scan, use onRandomTick to conditionally check for reactivation.
          onRandomTick(event) {
            const block = event.block;
            if (!FLUIDS._dormantRegistry.has(block)) return;
            // Check neighbors to see if any active block has a high fluid level.
            const reactivationThreshold = 0.2;
            const neighbors = [block.north(), block.east(), block.south(), block.west()];
            let reactivate = false;
            for (const nb of neighbors) {
              if (nb && FLUIDS._stateStore.has(nb)) {
                const nbState = FLUIDS._stateStore.get(nb);
                if (nbState.fluidLevel > reactivationThreshold) {
                  reactivate = true;
                  break;
                }
              }
            }
            if (reactivate) {
              const fluidId = FLUIDS._dormantRegistry.get(block);
              block.setType(fluidId);
              FLUIDS._stateStore.set(block, {
                fluidLevel: 1.0,
                stableTicks: 0,
                fluidState: "full",
                slope: "none"
              });
              block.setPermutation({ fluid_state: "full", slope: "none" });
              FLUIDS._dormantRegistry.delete(block);
            }
          },
          onPlayerDestroy(event) {
            const block = event.block;
            FLUIDS._dormantRegistry.delete(block);
          }
        });
      }
    });
  },

  // Check if any player is within a set radius (squared) of the block's center.
  _isPlayerNearby(block) {
    const center = block.center();
    const radiusSq = 100; // 10 blocks radius squared
    return world.getAllPlayers().some(player => {
      const loc = player.location;
      const dx = loc.x - center.x;
      const dy = loc.y - center.y;
      const dz = loc.z - center.z;
      return dx * dx + dy * dy + dz * dz <= radiusSq;
    });
  },

  // Computes the slope by comparing this block's fluid level with its four cardinal neighbors.
  _computeSlope(block) {
    if (!FLUIDS._stateStore.has(block)) return "none";
    const state = FLUIDS._stateStore.get(block);
    const currentLevel = state.fluidLevel;
    let bestDir = "none";
    let minLevel = currentLevel;
    const neighbors = {
      n: block.north(),
      e: block.east(),
      s: block.south(),
      w: block.west()
    };
    for (const [dir, nb] of Object.entries(neighbors)) {
      if (nb && FLUIDS._stateStore.has(nb)) {
        const nbState = FLUIDS._stateStore.get(nb);
        if (nbState.fluidLevel < minLevel) {
          minLevel = nbState.fluidLevel;
          bestDir = dir;
        }
      }
    }
    return bestDir;
  }
};

export default FLUIDS;

// Automatically initialize fluid components.
FLUIDS.init();

// Example usage:
// FLUIDS.register("cosmos:oil", { decayRate: 0.005, dormantThreshold: 0.1, stableTicksRequired: 40 });
// FLUIDS.registerBucket("cosmos:oil");
