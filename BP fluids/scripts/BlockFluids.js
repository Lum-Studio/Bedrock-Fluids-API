import { world } from "@minecraft/server";

const FLUIDS = {
  _registrations: new Map(),
  // Use a WeakMap keyed by block object to store simulation state.
  _stateStore: new WeakMap(),
  // Registry for dormant blocks.
  _dormantRegistry: new WeakMap(),

  // Fluid thresholds are defined as an array for dynamic lookup.
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

  register(fluidId, config = {}) {
    this._registrations.set(fluidId, {
      decayRate: config.decayRate || 0.005,
      dormantThreshold: config.dormantThreshold || 0.1,
      stableTicksRequired: config.stableTicksRequired || 40
    });
  },

  registerBucket(fluidId, emptyBucketId, filledBucketId) {
    world.beforeEvents.worldInitialize.subscribe(({ itemComponentRegistry }) => {
      itemComponentRegistry.registerCustomComponent(emptyBucketId, {
        onUse({ source: player, itemStack }) {
          const targetBlock = player.getBlockFromViewDirection();
          if (!targetBlock) return;
          // Allow bucket usage if the block is active full OR dormant.
          if (
            (targetBlock.matches(fluidId) && FLUIDS._stateStore.has(targetBlock) &&
             FLUIDS._stateStore.get(targetBlock).fluidState === "full") ||
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
            if (!FLUIDS._stateStore.has(block)) return;
            let state = FLUIDS._stateStore.get(block);
            const { decayRate, dormantThreshold, stableTicksRequired } = cfg;
            // Decay fluid level (assume deltaTime = 1 tick).
            const newLevel = Math.max(0, state.fluidLevel - decayRate);
            const stableTicks = Math.abs(newLevel - state.fluidLevel) < 0.001 ? state.stableTicks + 1 : 0;
            // Determine fluid state by looping over our thresholds.
            let newFluidState = "empty";
            for (const { threshold, state: fs } of FLUIDS._fluidThresholds) {
              if (newLevel >= threshold) {
                newFluidState = fs;
                break;
              }
            }
            state.fluidLevel = newLevel;
            state.stableTicks = stableTicks;
            state.fluidState = newFluidState;
            // Compute slope based on neighbors.
            const slope = FLUIDS._computeSlope(block);
            state.slope = slope;
            FLUIDS._stateStore.set(block, state);
            // Only update permutation if there's a change.
            block.setPermutation({ fluid_state: newFluidState, slope: slope });
            // Only a full block is allowed to go dormant.
            if (newFluidState === "full" && newLevel <= dormantThreshold && stableTicks >= stableTicksRequired) {
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
          // Use onRandomTick to conditionally reactivate without constant scanning.
          onRandomTick(event) {
            const block = event.block;
            if (!FLUIDS._dormantRegistry.has(block)) return;
            // Check neighbor blocks for active fluid with high fluid level.
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
              // Reactivate the dormant block.
              const fluidId = FLUIDS._dormantRegistry.get(block);
              block.setType(fluidId);
              // Reinitialize simulation state.
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

  _computeSlope(block) {
    if (!FLUIDS._stateStore.has(block)) return "none";
    const currentState = FLUIDS._stateStore.get(block);
    const currentLevel = currentState.fluidLevel;
    let slope = "none";
    let minLevel = currentLevel;
    const neighbors = {
      "n": block.north(),
      "e": block.east(),
      "s": block.south(),
      "w": block.west()
    };
    for (const [dir, nb] of Object.entries(neighbors)) {
      if (nb && FLUIDS._stateStore.has(nb)) {
        const nbState = FLUIDS._stateStore.get(nb);
        if (nbState.fluidLevel < minLevel) {
          minLevel = nbState.fluidLevel;
          slope = dir;
        }
      }
    }
    return slope;
  }
};

export default FLUIDS;

// Automatically initialize fluid components.
FLUIDS.init();

// Example usage (in another module):
// FLUIDS.register("cosmos:oil", { decayRate: 0.005, dormantThreshold: 0.1, stableTicksRequired: 40 });
// FLUIDS.registerBucket("cosmos:oil", "mycustom:oil_bucket", "mycustom:oil_bucket_filled");
