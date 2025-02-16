import { world } from "@minecraft/server";

/**
 * FLUIDS Module
 *
 * Registers custom fluid block components and bucket components.
 * Fluid simulation state is stored in an in-memory Map keyed by block.center() (rounded).
 * The block's permutation is updated with fluid_state and slope, which dynamically links to
 * a precomputed geometry identifier (e.g. "geometry.custom.fluid.oil.100_none").
 */
const FLUIDS = {
  _registrations: new Map(),
  _stateStore: new Map(),

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
          if (
            targetBlock.matches(fluidId) ||
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
        // Active fluid component
        blockComponentRegistry.registerCustomComponent(fluidId, {
          onPlace(event) {
            const block = event.block;
            const key = FLUIDS._getBlockKey(block);
            FLUIDS._stateStore.set(key, {
              fluidLevel: 1.0,
              stableTicks: 0,
              fluidState: "full",
              slope: "none"
            });
            block.setPermutation({ fluid_state: "full", slope: "none" });
          },
          onTick(event) {
            const block = event.block;
            const key = FLUIDS._getBlockKey(block);
            let state = FLUIDS._stateStore.get(key);
            if (!state) return;
            const { decayRate, dormantThreshold, stableTicksRequired } = cfg;
            // Decay fluid level (assume deltaTime = 1 per tick)
            const newLevel = Math.max(0, state.fluidLevel - decayRate);
            const stableTicks = Math.abs(newLevel - state.fluidLevel) < 0.001 ? state.stableTicks + 1 : 0;
            let newFluidState = "empty";
            if (newLevel >= 0.875) newFluidState = "full";
            else if (newLevel >= 0.75) newFluidState = "flowing_0";
            else if (newLevel >= 0.625) newFluidState = "flowing_1";
            else if (newLevel >= 0.5) newFluidState = "flowing_2";
            else if (newLevel >= 0.375) newFluidState = "flowing_3";
            else if (newLevel >= 0.25) newFluidState = "flowing_4";
            else if (newLevel >= 0.125) newFluidState = "flowing_5";
            state.fluidLevel = newLevel;
            state.stableTicks = stableTicks;
            state.fluidState = newFluidState;
            // Compute slope from neighbor fluid levels.
            const slope = FLUIDS._computeSlope(block);
            state.slope = slope;
            FLUIDS._stateStore.set(key, state);
            // Update block permutation; this dynamically links to the precomputed geometry.
            block.setPermutation({ fluid_state: newFluidState, slope: slope });
            if (newLevel <= dormantThreshold && stableTicks >= stableTicksRequired) {
              // Switch to dormant variant; dormant fluid uses geometry.full_block.
              block.setType(`${fluidId}_dormant`);
              FLUIDS._stateStore.delete(key);
            }
          },
          onPlayerDestroy(event) {
            const block = event.block;
            const key = FLUIDS._getBlockKey(block);
            FLUIDS._stateStore.delete(key);
          }
        });
        // Dormant fluid component.
        blockComponentRegistry.registerCustomComponent(`${fluidId}_dormant`, {
          onPlace(event) {
            const block = event.block;
            // For dormant fluid, we use the built-in geometry full_block.
            block.setPermutation({ fluid_state: "dormant", slope: "none" });
          },
          onPlayerDestroy(event) {
            // Cleanup if needed.
          }
        });
      }
    });
  },

  _getBlockKey(block) {
    const center = block.center();
    const x = Math.floor(center.x);
    const y = Math.floor(center.y);
    const z = Math.floor(center.z);
    return `${x}_${y}_${z}`;
  },

  _computeSlope(block) {
    const key = this._getBlockKey(block);
    const currentState = this._stateStore.get(key);
    if (!currentState) return "none";
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
      if (nb) {
        const nbKey = this._getBlockKey(nb);
        const nbState = this._stateStore.get(nbKey);
        if (nbState !== undefined && nbState.fluidLevel < minLevel) {
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

// Example usage elsewhere:
// FLUIDS.register("cosmos:oil", { decayRate: 0.005, dormantThreshold: 0.1, stableTicksRequired: 40 });
// FLUIDS.registerBucket("cosmos:oil", "mycustom:oil_bucket", "mycustom:oil_bucket_filled");
//NOT DONE