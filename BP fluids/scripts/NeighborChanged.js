import {
  Block,
  BlockPermutation,
  system,
  world,
  BlockComponentRegistry
} from "@minecraft/server";
import { onNeighborChanged } from "./NeighborChanged";

/*========================================================================
  Utility Functions
========================================================================*/

/**
 * Compares two BlockPermutation objects by comparing all their states.
 * @param {BlockPermutation} perm1 
 * @param {BlockPermutation} perm2 
 * @returns {boolean} True if both permutations are equivalent.
 */
function areEqualPermutations(perm1, perm2) {
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();
  return Object.keys(states1).every(key => states1[key] === states2[key]);
}

/**
 * Computes a fluid state string from a normalized depth (0–1).
 * @param {number} depth 
 * @returns {string} One of "full", "flowing_0", "flowing_1", "flowing_2", "flowing_3", "flowing_4", "flowing_5", or "empty".
 */
function fluidState(depth) {
  if (depth >= 0.875) return "full";
  if (depth >= 0.75) return "flowing_0";
  if (depth >= 0.625) return "flowing_1";
  if (depth >= 0.5) return "flowing_2";
  if (depth >= 0.375) return "flowing_3";
  if (depth >= 0.25) return "flowing_4";
  if (depth >= 0.125) return "flowing_5";
  return "empty";
}

/**
 * Calculates the slope for a fluid block by checking its four horizontal neighbors.
 * A neighbor is “open” if its block is air.
 * @param {Block} b - The fluid block.
 * @returns {string} The slope ("none", "n", "e", "s", "w", "ne", "nw", "se", or "sw").
 */
function calculateSlope(b) {
  const open = [];
  const directions = [
    { dx: 0, dz: -1, facing: "n" },
    { dx: 1, dz: 0, facing: "e" },
    { dx: 0, dz: 1, facing: "s" },
    { dx: -1, dz: 0, facing: "w" }
  ];
  for (const { dx, dz, facing } of directions) {
    try {
      const neighbor = b.offset({ x: dx, y: 0, z: dz });
      if (neighbor && neighbor.isAir) {
        open.push(facing);
      }
    } catch (e) {
      // Ignore if neighbor not loaded.
    }
  }
  if (open.length === 0) return "none";
  open.sort();
  if (open.length === 2) {
    const combo = open.join("");
    const diagonals = { "en": "ne", "es": "se", "nw": "nw", "sw": "sw" };
    if (diagonals[combo]) return diagonals[combo];
  }
  return open[0];
}

/**
 * Recalculates the fluid block’s permutation.
 * Reads the current "lumstudio:depth" (normalized, defaulting to 0.5),
 * computes a new "fluid_state" using fluidState(),
 * sets "lumstudio:fluidMode" to "active" if there is fluid above or "dormant" otherwise,
 * and computes the "slope" via calculateSlope().
 * It also preserves the geometry identifier ("lumstudio:geom") so that your JSON permutations select the correct geometry.
 * @param {Block} b - The fluid block.
 * @returns {BlockPermutation} The updated permutation.
 */
function refreshFluidPermutation(b) {
  let perm = b.permutation;
  const depth = perm.getState("lumstudio:depth") || 0.5;
  const newFluidState = fluidState(depth);
  const hasFluidAbove = b.above()?.typeId === b.typeId;
  const mode = hasFluidAbove ? "active" : "dormant";
  const slope = calculateSlope(b);
  
  perm = perm.withState("fluid_state", newFluidState)
           .withState("slope", slope)
           .withState("lumstudio:fluidMode", mode);
  
  // "lumstudio:geom" remains unchanged here; your JSON permutations choose geometry based on fluid_state, slope, and fluidMode.
  const geom = perm.getState("lumstudio:geom") || "geometry.custom.fluid.oil.12";
  perm = perm.withState("lumstudio:geom", geom);
  return perm;
}

/**
 * Updates the block’s permutation if the computed state has changed.
 * @param {Block} b - The fluid block.
 */
function updateFluidState(b) {
  if (!b || !b.typeId) return;
  const newPerm = refreshFluidPermutation(b);
  if (!areEqualPermutations(b.permutation, newPerm)) {
    b.setPermutation(newPerm);
  }
}

/*========================================================================
  Register Custom Fluid Behavior Component
========================================================================*/

// The following registers a custom block component using the official BlockComponentRegistry.
// In your fluid block JSON, list "lumstudio:fluidBehavior" under "minecraft:custom_components".
world.beforeEvents.worldInitialize.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lumstudio:fluidBehavior", {
    
    /**
     * onPlace is called when the block is placed.
     * It initializes the block's fluid states and registers a neighbor listener via onNeighborChanged.
     * @param {BlockComponentOnPlaceEvent} e 
     */
    onPlace(e) {
      const block = e.block;
      let perm = block.permutation;
      if (!perm.getState("fluid_state")) {
        perm = perm.withState("fluid_state", fluidState(0.5));
      }
      if (!perm.getState("slope")) {
        perm = perm.withState("slope", "none");
      }
      if (!perm.getState("lumstudio:fluidMode")) {
        const mode = (block.above()?.typeId === block.typeId) ? "active" : "dormant";
        perm = perm.withState("lumstudio:fluidMode", mode);
      }
      if (!perm.getState("lumstudio:geom")) {
        perm = perm.withState("lumstudio:geom", "geometry.custom.fluid.oil.12");
      }
      block.setPermutation(perm);
      
      // Register a neighbor listener using your library.
      // Create a unique ID for this block based on its location.
      const id = "fluid_" + block.location.x + "_" + block.location.y + "_" + block.location.z;
      this._unregisterNeighbor = onNeighborChanged(
        id,
        block.location,
        (changedPos, newType, oldType, watcherPos, dimId) => {
          updateFluidState(block);
        },
        block.dimension
      );
    },
    
    /**
     * onTick is called every tick (assuming the block has a tick component).
     * It recalculates the fluid state.
     * @param {BlockComponentTickEvent} e 
     */
    onTick(e) {
      try {
        updateFluidState(e.block);
      } catch (err) {
        console.error("FluidBehaviorComponent onTick error:", err);
      }
    },
    
    /**
     * onPlayerDestroy is called when a player destroys the block.
     * It cleans up the neighbor listener.
     * @param {BlockComponentPlayerDestroyEvent} e 
     */
    onPlayerDestroy(e) {
      if (this._unregisterNeighbor) {
        this._unregisterNeighbor();
        this._unregisterNeighbor = undefined;
      }
    }
    
  }, true);
});

export { };
