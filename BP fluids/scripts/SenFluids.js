import {
  Block,
  BlockPermutation,
  system,
  world,
  BlockComponentRegistry
} from "@minecraft/server";
import {NeighborMonitor, NeighborMonitorAPI, onNeighborChanged } from "./NeighborChanged";

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
 * Computes a fluid state string based on a normalized depth value (0–1).
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
 * Calculates the slope by examining the horizontal neighbors.
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
      // Ignore if neighbor is not loaded.
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
 * Recalculates and returns an updated fluid block permutation.
 * It uses the block’s current "lumstudio:depth" to compute a new fluid_state,
 * determines the slope from horizontal neighbors, and sets "lumstudio:fluidMode" to "active" if there is fluid above, or "dormant" otherwise.
 * It also preserves the geometry identifier ("lumstudio:geom") so that the JSON permutations select the correct geometry.
 * @param {Block} b - The fluid block.
 * @returns {BlockPermutation} The updated permutation.
 */
function refreshFluidPermutation(b) {
  let perm = b.permutation;
  // Get current depth; default to 0.5 if not set.
  const depth = perm.getState("lumstudio:depth") || 0.5;
  const newFluidState = fluidState(depth);
  // Determine mode: if there is fluid above the block (same type), consider it "active"
  const hasFluidAbove = b.above()?.typeId === b.typeId;
  const mode = hasFluidAbove ? "active" : "dormant";
  const slope = calculateSlope(b);
  
  perm = perm.withState("fluid_state", newFluidState)
           .withState("slope", slope)
           .withState("lumstudio:fluidMode", mode);
  // Note: Geometry is selected entirely via JSON permutations.
  const geom = perm.getState("lumstudio:geom") || "geometry.custom.fluid.oil.12";
  perm = perm.withState("lumstudio:geom", geom);
  return perm;
}

/**
 * Updates the fluid block's permutation if its computed state has changed.
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
  Custom Fluid Behavior Component
========================================================================*/

/**
 * FluidBehaviorComponent is a custom block component that implements dynamic fluid behavior.
 * It initializes state on placement, updates on every tick, and cleans up its neighbor listener when destroyed.
 * The component uses your NeighborMonitorAPI (onNeighborChanged) to detect neighbor changes.
 *

 */
world.beforeEvents.worldInitialize.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lumstudio:fluidBehavior", {
    /**
     * Called when the block is placed.
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
      
      // Register neighbor listener using your library.
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
     * Called on every tick.
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
     * Called when a player destroys the block.
     * Cleans up the neighbor listener.
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
