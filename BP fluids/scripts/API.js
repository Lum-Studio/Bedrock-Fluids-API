import { world, system, BlockPermutation, Block } from "@minecraft/server";
import { BlockUpdate } from "./BlockUpdate.js";
import { FluidQueue } from "./queue";

/*========================================================================
  Constants
========================================================================*/

export const AIR = BlockPermutation.resolve("air");
export const DIRECTIONS = [
  { dx: 0, dy: 0, dz: -1, facing: "n" },
  { dx: 1, dy: 0, dz: 0, facing: "e" },
  { dx: 0, dy: 0, dz: 1, facing: "s" },
  { dx: -1, dy: 0, dz: 0, facing: "w" },
];

/*========================================================================
  Utility Functions
========================================================================*/

export function areEqualPermutations(perm1, perm2) {
  if (!perm1 || !perm2) return false;
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();
  return Object.keys(states1).every(key => states1[key] === states2[key]);
}

export function fluidState(depth) {
  if (depth >= 0.875) return "full";
  if (depth >= 0.75) return "flowing_0";
  if (depth >= 0.625) return "flowing_1";
  if (depth >= 0.5) return "flowing_2";
  if (depth >= 0.375) return "flowing_3";
  if (depth >= 0.25) return "flowing_4";
  if (depth >= 0.125) return "flowing_5";
  return "empty";
}

export function calculateSlope(b) {
  const open = [];
  for (const { dx, dz, facing } of DIRECTIONS) {
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

/*========================================================================
  Core Fluid Logic
========================================================================*/

/**
 * The core update logic for a single fluid block.
 * This function is called by the FluidQueue for each block that needs an update.
 * @param {Block} b The fluid block to update.
 */
function fluidUpdate(b) {
    if (!b || !b.isValid() || !b.permutation) return;

    const fluidBlock = b.permutation;
    const maxSpreadDistance = 7; // This can be configured per fluid type later
    const fluidStates = fluidBlock.getAllStates();
    const depth = fluidStates["lumstudio:depth"];
    const isSource = depth === maxSpreadDistance;
    
    const hasFluidAbove = b.above()?.typeId === b.typeId;
    let isFallingFluid = hasFluidAbove || fluidStates["lumstudio:fluidMode"] === "active";

    // Rule 1: Flowing down into air
    const belowBlock = b.below();
    if (belowBlock?.isAir) {
        const newPerm = fluidBlock.withState("lumstudio:fluidMode", "active");
        belowBlock.setPermutation(newPerm);
        // The current block will be removed or its depth reduced by the source
        // This is handled by the update of the block that flows into this one.
        // For simplicity, we let the source block handle the depth reduction.
        if (!isSource) {
            b.setPermutation(AIR);
        }
        return;
    }

    // Rule 2: Drying up
    // Check horizontal neighbors to see if this block should be sustained
    let canBeSustained = false;
    if (isSource) {
        canBeSustained = true;
    } else {
        for (const dir of DIRECTIONS) {
            const neighbor = b.offset(dir);
            if (neighbor?.typeId === b.typeId && neighbor.permutation.getState("lumstudio:depth") > depth) {
                canBeSustained = true;
                break;
            }
        }
        if (hasFluidAbove) canBeSustained = true;
    }

    if (!canBeSustained) {
        b.setPermutation(AIR);
        return;
    }

    // Rule 3: Spreading sideways
    if (depth > 0 && !isFallingFluid) {
        const newDepth = depth - 1;
        if (newDepth >= 0) {
            for (const dir of DIRECTIONS) {
                const neighbor = b.offset(dir);
                if (neighbor?.isAir) {
                    const perm = fluidBlock.withState("lumstudio:depth", newDepth);
                    neighbor.setPermutation(perm);
                }
            }
        }
    }

    // Final state update for visuals
    const newSlope = calculateSlope(b);
    const newFluidState = fluidState(depth / maxSpreadDistance);
    const newMode = isFallingFluid ? "active" : "dormant";
    
    const newPerm = fluidBlock.withState("fluid_state", newFluidState)
                           .withState("slope", newSlope)
                           .withState("lumstudio:fluidMode", newMode);

    if (!areEqualPermutations(b.permutation, newPerm)) {
        b.setPermutation(newPerm);
    }
}

/*========================================================================
  Fluid Queue & Event Listener Initialization
========================================================================*/

// A map of all registered fluid types and their corresponding queues.
import { Queues } from "./generated/register_fluids.js";

// Start the run interval for all registered fluid queues.
for (const queue of Object.values(Queues)) {
  queue.run(20); // Process 20 updates per tick for each fluid type.
}

// Register a single, global listener for all block updates.
BlockUpdate.on((update) => {
  const block = update.block;
  
  // Check if the updated block is a fluid type that we are managing.
  if (block && block.isValid() && Queues[block.typeId]) {
    const queue = Queues[block.typeId];
    queue.add(block);
  }
});
