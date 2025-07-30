const API_JS_CONTENT = JSON.stringify(`import { world, system, BlockPermutation, Block } from "@minecraft/server";
import { BlockUpdate } from "./BlockUpdate.js";
import { Queues } from "./generated/register_fluids.js";

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
        if (!isSource) {
            b.setPermutation(AIR);
        }
        return;
    }

    // Rule 2: Drying up
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

// Start the run interval for all registered fluid queues.
for (const queue of Object.values(Queues)) {
  queue.run(20); // Process 20 updates per tick for each fluid type.
}

// Register a single, global listener for all block updates.
BlockUpdate.on((update) => {
  const block = update.block;
  
  if (block && block.isValid() && Queues[block.typeId]) {
    const queue = Queues[block.typeId];
    queue.add(block);
  }
});
`);

    const BLOCKUPDATE_JS_CONTENT = JSON.stringify(`import { world, system, Block, Dimension } from "@minecraft/server";
export { BlockUpdate };

/**
 * @typedef {Object} Offset
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

const Events = {};
const Offsets = [
  { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 }
];
let LastEventId = -1;

class BlockUpdate {
  constructor(data) {
    this.block = data.block;
    this.source = data.source;
  }

  static on(callback) {
    const id = ++LastEventId + "";
    Events[id] = callback;
    return id;
  }

  static off(id) {
    delete Events[id];
  }

  static trigger(source) {
    for (const offset of Offsets) {
      try {
        const block = source.offset(offset);
        if (block) BlockUpdate.triggerEvents({ block, source });
      } catch {}
    }
  }

  static triggerEvents(data) {
    const update = new BlockUpdate(data);
    Object.values(Events).forEach(callback => callback(update));
  }
}

const easyTrigger = (data) => BlockUpdate.trigger(data.block);

world.beforeEvents.playerInteractWithBlock.subscribe(data => {
  if (!data.isFirstEvent) return;
  system.run(() => {
    if (data.block.isValid && !data.cancel) BlockUpdate.trigger(data.block);
  });
});

world.afterEvents.playerBreakBlock.subscribe(easyTrigger);
world.afterEvents.buttonPush.subscribe(easyTrigger);
world.afterEvents.leverAction.subscribe(easyTrigger);
world.afterEvents.pistonActivate.subscribe(easyTrigger);
world.afterEvents.playerPlaceBlock.subscribe(easyTrigger);
world.afterEvents.pressurePlatePop.subscribe(easyTrigger);
world.afterEvents.pressurePlatePush.subscribe(easyTrigger);
world.afterEvents.tripWireTrip.subscribe(easyTrigger);
world.afterEvents.projectileHitBlock.subscribe(data => BlockUpdate.trigger(data.getBlockHit().block));

world.afterEvents.explosion.subscribe(data => {
  const triggeredBlocks = data.getImpactedBlocks().slice();
  for (const source of triggeredBlocks) {
    BlockUpdate.triggerEvents({ block: source });
    for (const offset of Offsets) {
      try {
        const neighbor = source.offset(offset);
        if (neighbor && !triggeredBlocks.includes(neighbor)) {
          triggeredBlocks.push(neighbor);
          BlockUpdate.triggerEvents({ block: neighbor, source });
        }
      } catch {}
    }
  }
});

const OriginalMethods = [
  { class: Block, name: "setType" }, { class: Block, name: "setPermutation" },
  { class: Block, name: "setWaterlogged" }, { class: Dimension, name: "setBlockType" },
  { class: Dimension, name: "setBlockPermutation" }
];

for (const data of OriginalMethods) {
  const originalMethod = data.class.prototype[data.name];
  data.class.prototype[data.name] = function(...args) {
    originalMethod.apply(this, args);
    const block = this instanceof Dimension ? this.getBlock(args[0]) : this;
    if (block) BlockUpdate.trigger(block);
  };
}
`);

    const FLUIDS_JS_CONTENT = JSON.stringify(`import { ItemStack, BlockPermutation, system, world } from "@minecraft/server";
import { AIR } from "./API";

// This flag prevents multi-use bugs with buckets
let currentTickRunned = false;

/**
 * Handles a player using an empty bucket on a fluid source block.
 * @param {ItemStack} itemStack The item being used.
 * @param {Player} player The player using the item.
 * @param {Block} block The block that was interacted with.
 */
function handleFluidTaking(itemStack, player, block) {
  if (!block) return;

  // Native components now handle placing, so we only need to handle taking fluid.
  const fluidState = block.permutation?.getState("fluid_state");
  if (block.hasTag("fluid") && fluidState === "full" && itemStack.typeId === "minecraft:bucket") {
    const bucketItem = new ItemStack(\"
    
    block.setPermutation(AIR);
    player.getComponent("equippable").setEquipment("Mainhand", bucketItem);
  }
}

// Listen for item use on a block (e.g., right-clicking a fluid with a bucket)
world.beforeEvents.itemUseOn.subscribe(ev => {
  if (currentTickRunned) {
    ev.cancel = true;
    return;
  };
  currentTickRunned = true;
  handleFluidTaking(ev.itemStack, ev.source, ev.block);
  system.run(() => {
    currentTickRunned = false;
  });
});

// This interval handles fluid effects on players
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const headBlock = player.getHeadLocation();
    const bodyBlock = player.location;
    const dimension = player.dimension;

    // Fluid Fog Effect
    if (dimension.getBlock(headBlock)?.hasTag("fluid")) {
      player.runCommandAsync("fog @s push lumstudio:custom_fluid_fog fluid_fog");
    } else {
      player.runCommandAsync("fog @s remove fluid_fog");
    }

    // Buoyancy & Slow Falling Effects
    const velocity = player.getVelocity();
    if (dimension.getBlock(bodyBlock)?.hasTag("fluid")) {
        // Apply slow falling when jumping
        if (player.isJumping) {
            player.addEffect("slow_falling", 5, { showParticles: false, amplifier: 1 });
        }
        // Apply buoyancy to counteract gravity
        if (velocity.y < 0.05) {
             player.applyKnockback(0, 0, 0, Math.abs(velocity.y) * 0.3 + 0.08);
        }
    }
  }
}, 2);
`);

    const QUEUE_JS_CONTENT = JSON.stringify(`import { system } from "@minecraft/server";

export class FluidQueue {
    #marked = new Set();
    #optimized = [];
    #instant = [];
    #isRunning = false;
    #runId;

    constructor(operation, blockTypeId) {
        if (typeof operation !== 'function' || operation.length !== 1) {
            throw new Error("Operation should be a function with one parameter");
        }
        this.type = blockTypeId;
        this.blockOperation = operation;
    }

    add(block) {
        if (!this.#isRunning) return;
        if (block.typeId !== this.type) return;

        if (this.#marked.has(block)) {
            this.#instant.push(block);
            this.#marked.delete(block);
            const index = this.#optimized.indexOf(block);
            if (index !== -1) this.#optimized.splice(index, 1);
        } else {
            this.#optimized.push(block);
        }
    }

    skipQueueFor(block) {
        this.#marked.add(block);
    }

    run(countPerTick) {
        this.stop();
        this.#runId = system.runInterval(() => {
            for (const block of this.#instant) {
                try { this.blockOperation(block); } catch (e) { console.error(\`FluidQueue Instant Error: \

            for (let i = 0; i < countPerTick && this.#optimized.length > 0; i++) {
                const block = this.#optimized.shift();
                if (block?.typeId === this.type) {
                    try { this.blockOperation(block); } catch (e) { console.error(\`FluidQueue Ticking Error: \
                }
            }
        }, 0);
        this.#isRunning = true;
    }

    stop() {
        if (this.#isRunning) {
            system.clearRun(this.#runId);
            this.#isRunning = false;
        }
    }
}
`);