import { world, system, BlockPermutation, Block } from "@minecraft/server";
import { onNeighborChanged } from "./NeighborChanged";
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

function fluidUpdate(b) {
  const fluidBlock = b.permutation;
  const maxSpreadDistance = 7; // Configurable per fluid type
  const fluidStates = fluidBlock.getAllStates();
  const depth = fluidStates["lumstudio:depth"];
  const isSource = depth === maxSpreadDistance;
  let isFallingFluid = fluidStates["lumstudio:fluidMode"] === "active";

  const neighborStates = [];
  let neighborDepth = -1;
  for (const dir of DIRECTIONS) {
    const neighbor = b.offset({ x: dir.dx, y: 0, z: dir.dz });
    if (neighbor?.typeId === b.typeId) {
      const states = neighbor.permutation.getAllStates();
      neighborStates.push(states);
      if (neighborDepth < states["lumstudio:depth"]) {
        neighborDepth = states["lumstudio:depth"];
      }
    } else {
      neighborStates.push(undefined);
    }
  }

  const hasFluidAbove = b.above()?.typeId === b.typeId;
  const hasFluidBelow = b.below()?.typeId === b.typeId;

  // Rule 1: Drying up
  if (!isSource && !hasFluidAbove && neighborDepth < depth) {
    b.setPermutation(AIR);
    return;
  }

  // Rule 2: Becoming a falling block
  if (hasFluidAbove && !isFallingFluid) {
    isFallingFluid = true;
  }

  // Rule 3: Flowing down
  const belowBlock = b.below();
  if (belowBlock?.isAir) {
    belowBlock.setPermutation(fluidBlock.withState("lumstudio:fluidMode", "active"));
    if (depth > 0) {
        b.setPermutation(fluidBlock.withState("lumstudio:depth", depth -1));
    } else {
        b.setPermutation(AIR);
    }
    return;
  }

  // Rule 4: Spreading sideways
  if (depth > 0 && !isFallingFluid) {
    const newDepth = depth - 1;
    for (const dir of DIRECTIONS) {
        const neighbor = b.offset(dir);
        if (neighbor?.isAir) {
            const perm = fluidBlock.withState("lumstudio:depth", newDepth);
            neighbor.setPermutation(perm);
        }
    }
  }

  // Final state update
  const newSlope = calculateSlope(b);
  const newFluidState = fluidState(depth / maxSpreadDistance);
  const newMode = isFallingFluid ? "active" : "dormant";
  
  let newPerm = fluidBlock.withState("fluid_state", newFluidState)
                         .withState("slope", newSlope)
                         .withState("lumstudio:fluidMode", newMode);

  if (!areEqualPermutations(b.permutation, newPerm)) {
    b.setPermutation(newPerm);
  }
}


/*========================================================================
  Fluid Queue Initialization
========================================================================*/

export const Queues = {
  "lumstudio:oil": new FluidQueue(fluidUpdate, "lumstudio:oil"),
  // Register other fluids here
};

for (const queue of Object.values(Queues)) {
  queue.run(20); // Process 20 updates per tick per queue
}

/*========================================================================
  Custom Component Registration
========================================================================*/

world.beforeEvents.worldInitialize.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lumstudio:fluidBehavior", {
    _unregisterNeighbor: undefined,

    onPlace(e) {
      const { block } = e;
      const queue = Queues[block.typeId];
      if (queue) {
        queue.add(block);
      }

      // Register for neighbor changes
      const id = `fluid_${block.location.x}_${block.location.y}_${block.location.z}`;
      this._unregisterNeighbor = onNeighborChanged(
        id,
        block.location,
        () => {
          if (queue) queue.add(block);
        },
        block.dimension
      );
    },

    onTick(e) {
      const { block } = e;
      const queue = Queues[block.typeId];
      if (queue) {
        queue.add(block);
      }
    },

    onPlayerDestroy(e) {
      if (this._unregisterNeighbor) {
        this._unregisterNeighbor();
        this._unregisterNeighbor = undefined;
      }
      // Optional: remove from queue if needed, though the queue handles invalid blocks.
    }
  });
});