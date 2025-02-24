import {
  Direction,
  ItemStack,
  BlockPermutation,
  system,
  world,
  Block,
} from "@minecraft/server";
import { FluidQueue } from "./queue";

const air = BlockPermutation.resolve("air"); // diagonal directions offset is 45 degrees in clockwise
const directionNums = {
  "n": 0,
  "none": 0,
  "e": 1,
  "s": 2,
  "w": 3,
  "ne": 0,
  "se": 1,
  "sw": 2,
  "nw": 3,
}
const directions = [
  { dx: 0, dy: 0, dz: -1, facing: "n" },
  { dx: 1, dy: 0, dz: 0, facing: "e" },
  { dx: 0, dy: 0, dz: 1, facing: "s" },
  { dx: -1, dy: 0, dz: 0, facing: "w" },
];
const invisibleStatesNames = [
  "lumstudio:invisible_north",
  "lumstudio:invisible_east",
  "lumstudio:invisible_south",
  "lumstudio:invisible_west",
  "lumstudio:invisible_up",
  "lumstudio:invisible_down"
];

let currentTickRunned = false;

/**
 * Get the direction string from the direction face or vector direction.
 * @param {string|object} direction The direction face (Up, Down) or vector direction.
 * @returns {string} The direction string.
 */
function getDirectionString(direction) { // I don't know what it should do
  if (typeof direction === "string") {
    // If the direction is a face
    switch (direction) {
      case Direction.Up:
        return "above";
      case Direction.Down:
        return "below";
      default:
        return direction.toLowerCase();
    }
  } else if (typeof direction === "object") {
    // If the direction is a vector
    if (direction.dx === 0 && direction.dz === -1) {
      return "n";
    } else if (direction.dx === 0 && direction.dz === 1) {
      return "s";
    } else if (direction.dx === 1 && direction.dz === 0) {
      return "e";
    } else if (direction.dx === -1 && direction.dz === 0) {
      return "w";
    } else {
      return "Unknown";
    }
  } else {
    return "Unknown";
  }
}

function placeOrTakeFluid(itemStack, player, hit) {
  const tag = itemStack.getTags().find((str) => str.startsWith("placer:"));
  if (!tag || !hit) return;

  const { face, block: b } = hit;
  const dir = getDirectionString(face);
  const nBlock = b[dir]();
  const maxSize = nBlock.hasTag("7-length") ? 8 : 7;

  if (nBlock.isAir && tag) {
    player
      .getComponent("equippable")
      .setEquipment("Mainhand", new ItemStack("bucket"));
    nBlock.setPermutation(BlockPermutation.resolve(tag.slice(7)));
  }

  if (
    nBlock.hasTag("fluid") &&
    nBlock.permutation.getState("lumstudio:depth") == maxSize - 1 &&
    itemStack.typeId == "minecraft:bucket"
  ) {
    nBlock.setPermutation(air);
    player
      .getComponent("equippable")
      .setEquipment("Mainhand", new ItemStack("lumstudio:oil_bucket"));
  }
}

world.afterEvents.itemUse.subscribe(({ itemStack, source: player }) => {
  const hit = player.getBlockFromViewDirection({
    includePassableBlocks: true,
    maxDistance: 6,
  });
  placeOrTakeFluid(itemStack, player, hit);
});

world.beforeEvents.itemUseOn.subscribe((ev) => {
  if (currentTickRunned) return;
  const { source: player, blockFace, itemStack, block } = ev;
  try {
    const equippment = player.getComponent("equippable");
    const perm = BlockPermutation.resolve(itemStack.typeId);
    const dir = getDirectionString(blockFace);
    let replaced = block[dir]();
    if (
      replaced.dimension.getEntitiesAtBlockLocation(replaced.location).length >
      0
    )
      return;
    if (!replaced.hasTag("fluid")) return;
    currentTickRunned = true;
    system.run(() => {
      let iS = equippment.getEquipment("Mainhand");
      if (!iS.isStackableWith(itemStack)) return;

      replaced.setPermutation(perm);
      if (
        !block.dimension
          .getBlock(replaced.location)
          .permutation.matches(itemStack.typeId)
      )
        return;
      iS.amount > 1 ? iS.amount-- : (iS = undefined);
      equippment.setEquipment("Mainhand", iS);
    });
  } catch { }
});

system.runInterval(() => {
  currentTickRunned = false;
  const players = world.getPlayers();

  for (const player of players) {
    // Fluid buoyancy
    if (
      player.isJumping &&
      player.dimension
        .getBlock({ ...player.location, y: player.location.y + 0.7 })
        .hasTag("fluid")
    ) {
      const yVelocity = player.getVelocity().y
      player.applyKnockback(
        0,
        0,
        0,
        Math.max(0.1, Math.min(yVelocity * 0.7 + 0.1, 0.3))
      );
      system.run(() =>
        player.applyKnockback(
          0,
          0,
          0,
          Math.max(0.1, Math.min(yVelocity * 0.7 + 0.1, 0.3))
        )
      );
    } else if (
      (player.dimension
        .getBlock({ ...player.location, y: player.location.y + 1 })
        .hasTag("fluid") ||
        player.dimension.getBlock(player.location).hasTag("fluid")) &&
      player.getVelocity().y < 0.01
    ) {
      player.applyKnockback(0, 0, 0, player.getVelocity().y * 0.2);
    }

    // Fluid fog
    if (player.dimension.getBlock(player.getHeadLocation()).hasTag("fluid")) {
      player.runCommand("fog @s push lumstudio:custom_fluid_fog fluid_fog");
    } else {
      player.runCommand("fog @s remove fluid_fog");
    }

    if (
      player.isJumping &&
      player.dimension
        .getBlock({ ...player.location, y: player.location.y + 0.7 })
        .hasTag("fluid")
    ) {
      player.addEffect("slow_falling", 1, { showParticles: false });
    }
  }
}, 2);

// Queues
const Queues = {
  "lumstudio:oil": new FluidQueue(fluidBasic, "lumstudio:oil"),
};

for (const queue of Object.values(Queues)) {
  queue.run(20);
}
/**
 * 
 * @param {BlockPermutation} perm1 
 * @param {BlockPermutation} perm2 
 */
function areEqualPerms(perm1, perm2) {
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();
  return Object.keys(states1).every((value) => states1[value] === states2[value])
}
/**
 * Refreshes the fluid states.
 * @param {BlockPermutation} permutation The fluid block permutation.
 * @param {Record<string, string | number | boolean>[]} neighborStates States of Neighbor fluids
 * @param {boolean} below 
 * @returns new permutation
 */
function refreshStates(permutation, neighborStates, below, isSource) {
  let newPerm = permutation.withState(invisibleStatesNames[5], +below);
  for (let i = 0; i < 4; i++) {
    const num = directionNums[permutation.getState("lumstudio:direction")];
    if (neighborStates[i]) {
      const nDepth = neighborStates[i]["lumstudio:depth"];
      const depth = permutation.getState("lumstudio:depth");
      newPerm = newPerm.withState(invisibleStatesNames[(i + num) % 4], depth < nDepth ? 2 : 0)
    }
  }
  // TODO: direction choosing
  return newPerm;
}

/**
 * Refreshes the fluid states.
 * @param {BlockPermutation} permutation The fluid block permutation.
 * @param {Record<string, string | number | boolean>[]} neighborStates States of Neighbor fluids
 * @param {boolean} above 
 * @param {boolean} below 
 * @param {boolean} isSource 
 * @returns new permutation
 */
function refreshStatesForFalling(permutation, neighborStates, below, above, isSource) {
  let newPerm = permutation
    .withState(invisibleStatesNames[4], +above)
    .withState(invisibleStatesNames[5], +below);
  for (let i = 0; i < 4; i++) {
    if (neighborStates[i]) {
      const nDepth = neighborStates[i]["lumstudio:depth"];
      const depth = permutation.getState("lumstudio:depth");
      const isMicro = nDepth === depth - 1 - isSource;// analog to (isSource ? nDepth === depth - 2 : nDepth === depth - 1)
      newPerm = newPerm.withState(invisibleStatesNames[i], depth < nDepth ? 2 : +isMicro)
    }
  }
  return newPerm;
  // here shouldn't be directions
}
/**
 * Updates the fluid.
 * @param {Block} b The fluid block.
 */
function fluidBasic(b) {
  const fluidBlock = b.permutation;
  const maxSpreadDistance = 5;
  const dimension = b.dimension;
  const fluidStates = fluidBlock.getAllStates();
  const depth = fluidStates["lumstudio:depth"];
  const isSource =
    depth === maxSpreadDistance - 1 ||
    depth === maxSpreadDistance + 1;
  let isFallingFluid = depth >= maxSpreadDistance; // full fluid blocks
  const neighborStates = [];
  let neighborDepth = 1;
  for (const dir of directions) { // Geting all States
    const neighbor = b.offset({
      x: dir.dx,
      y: 0,
      z: dir.dz
    });
    if (neighbor?.typeId === b.typeId) {
      const states = neighbor.permutation.getAllStates();
      neighborStates.push(states)
      if (neighborDepth < states["lumstudio:depth"])
        neighborDepth = states["lumstudio:depth"];
    } else
      neighborStates.push(undefined)
  };
  const hasFluidAbove = b.above().typeId === b.typeId;
  const hasFluidBelow = b.below().typeId === b.typeId;
  // should dry test
  if (
    (isFallingFluid ? !hasFluidAbove : neighborDepth <= depth) && !isSource
  ) {
    // TODO: marking neighbors
    b.setPermutation(air);
    return
  }
  if (hasFluidAbove && !isFallingFluid) {
    isFallingFluid = true;
    fluidBlock = fluidBlock.withState(
      "lumstudio:depth", isSource ? maxSpreadDistance + 1 : maxSpreadDistance
    )
  }
  if (isFallingFluid) {
    fluidBlock = refreshStatesForFalling(fluidBlock, neighborStates, hasFluidBelow, hasFluidAbove, isSource)
  } else {
    fluidBlock = refreshStates(fluidBlock, neighborStates, hasFluidBelow, isSource)
  }
  if (!areEqualPerms(b.permutation, fluidBlock)) {
    // TODO: marking neighbors
  }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const { sourceBlock: b, id } = event;
  if (id !== "lumstudio:fluid" || !b) return;
  const distanceSquared = 35 * 35;
  const players = world.getAllPlayers();
  const isWithinDistance = players.every((P) => {
    const dx = b.location.x - P.location.x;
    const dy = b.location.y - P.location.y;
    const dz = b.location.z - P.location.z;

    const distanceSqr = dx * dx + dy * dy + dz * dz;
    return distanceSqr < distanceSquared;
  });
  if (!isWithinDistance) return;

  const Q = Queues[b.typeId];
  if (Q) {
    Q.add(b);
  }
});


// Assume neighborWatcher is an instance of InternalOptimizedNeighborWatcher.
const fluidWatchers = new Map();

/**
 * Registers a watcher for a custom fluid block.
 * @param {object} fluidBlockPos - Position { x, y, z } of the fluid block.
 */
function registerFluidWatcher(fluidBlockPos) {
  const key = `${fluidBlockPos.x},${fluidBlockPos.y},${fluidBlockPos.z}`;
  if (fluidWatchers.has(key)) return; // Already watching.
  
  const watcher = neighborWatcher.addWatcher(fluidBlockPos, (changedPos, newType, oldType) => {
    // Custom logic: For example, if the neighbor now becomes air, fluid may spread into that space.
    // Update your fluid simulation accordingly.
    console.log(`Fluid at ${key} sees neighbor change: ${oldType} -> ${newType}`);
    updateFluidFlow(fluidBlockPos, changedPos, newType, oldType);
  });
  
  fluidWatchers.set(key, watcher);
}

/**
 * Unregisters the watcher for a fluid block when it's no longer needed.
 * @param {object} fluidBlockPos - Position of the fluid block.
 */
function unregisterFluidWatcher(fluidBlockPos) {
  const key = `${fluidBlockPos.x},${fluidBlockPos.y},${fluidBlockPos.z}`;
  const watcher = fluidWatchers.get(key);
  if (watcher) {
    neighborWatcher.removeWatcher(watcher);
    fluidWatchers.delete(key);
  }
}

/**
 * Example function to update fluid flow based on neighbor change.
 */
function updateFluidFlow(fluidPos, changedPos, newType, oldType) {
  // Your custom logic to simulate fluid flow.
  // E.g., if newType is "minecraft:air", consider flowing fluid into that space.
  // If a neighbor becomes solid, you may stop flow in that direction.
  // This function would integrate with your custom fluids API.
  console.log(`Updating fluid flow at (${fluidPos.x}, ${fluidPos.y}, ${fluidPos.z}) due to change at (${changedPos.x}, ${changedPos.y}, ${changedPos.z}).`);
}


export class FluidQueue {
  #marked = new Set(); // Use Set for faster membership check
  #optimized = [];
  #instant = [];
  #isRunning = false;
  #runId;
  /**
   * Callback Function that changes the block
   * @callback callback
   * @param {Block} block
   */
  /**
   * Creates new Fluid Queue
   * @param {callback} operation
   * @param {string} blockTypeId
   */
  constructor(operation, blockTypeId) {
      if (typeof operation !== 'function' || operation.length !== 1) {
          throw new Error("Operation should be a function with one parameter");
      }
      this.type = blockTypeId;
      this.blockOperation = operation;
  }
  /**
   * Adds the fluid block to the queue
   * @param {Block} block
   */
  add(block) {
      if (!this.#isRunning) {
          console.warn("§cThe fluid queue is stopped, you can't use any methods");
      } else if (block.typeId === this.type) {
          if (this.#marked.has(block)) {
              this.#instant.push(block);
              this.#marked.delete(block);
              const index = this.#optimized.findIndex((v) => v === block);
              if (index !== -1) this.#optimized.splice(index, 1);
          } else {
              this.#optimized.push(block);
          }
      }
  }
  /**
   * Makes the block ignore queue the next time
   * @param {Block} block
   */
  skipQueueFor(block) {
      this.#marked.add(block);
  }
  /**
   * Starts the fluid flow, spreading and changing
   * @param {number} countPerTick Runs all registered fluids and their operation for x amount of times in a tick
   */
  run(countPerTick) {
      this.stop();
      this.#runId = system.runInterval(() => {
          for (const block of this.#instant) {
              try {
                  this.blockOperation(block);
              } catch (error) {
                  console.error(`FluidQueue of ${this.type}: Instant: ${error}`);
              }
          }
          this.#instant.length = 0;
          for (let iteration = 0; iteration < countPerTick; iteration++) {
              if (this.#optimized.length === 0) break;

              const block = this.#optimized.shift();
              if (!block?.typeId || block.typeId !== this.type) continue;

              try {
                  this.blockOperation(block);
              } catch (error) {
                  console.error(`FluidQueue of ${this.type}: Ticking: Iteration #${iteration}: ${error}`);
              }
          }
      }, 0);
      this.#isRunning = true;
  }
  /**
   * Stops the fluid flow, spreading and changing
   */
  stop() {
      if (this.#isRunning) {
          system.clearRun(this.#runId);
          this.#isRunning = false;
      }
  }
}

import {
  BlockPermutation,
  system,
  world,
  Block,
  Direction,
} from "@minecraft/server";

/**
 * Constants used by the fluid component.
 */
const AIR = BlockPermutation.resolve("air");
const DIRECTIONS = [
  { dx: 0, dy: 0, dz: -1, facing: "n" },
  { dx: 1, dy: 0, dz: 0, facing: "e" },
  { dx: 0, dy: 0, dz: 1, facing: "s" },
  { dx: -1, dy: 0, dz: 0, facing: "w" },
];
// Invisible state names for fluid simulation.
const INVISIBLE_STATE_NAMES = [
  "lumstudio:invisible_north",
  "lumstudio:invisible_east",
  "lumstudio:invisible_south",
  "lumstudio:invisible_west",
  "lumstudio:invisible_up",
  "lumstudio:invisible_down"
];

/**
 * Compares two BlockPermutation objects by comparing all of their states.
 * @param {BlockPermutation} perm1 
 * @param {BlockPermutation} perm2 
 * @returns {boolean} True if both have identical states.
 */
function areEqualPermutations(perm1, perm2) {
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();
  return Object.keys(states1).every(key => states1[key] === states2[key]);
}

/**
 * Refreshes the fluid state for non-falling (dormant) fluids.
 * @param {BlockPermutation} perm - The current fluid block permutation.
 * @param {Array<Record<string, any>>} neighborStates - States of horizontal neighbors.
 * @param {boolean} below - Whether there is fluid below.
 * @param {boolean} isSource - Whether this block is a source fluid.
 * @returns {BlockPermutation} Updated permutation.
 */
function refreshStates(perm, neighborStates, below, isSource) {
  let newPerm = perm.withState(INVISIBLE_STATE_NAMES[5], +below);
  const currentDepth = perm.getState("lumstudio:depth");
  for (let i = 0; i < 4; i++) {
    const neighbor = neighborStates[i];
    if (neighbor) {
      const nDepth = neighbor["lumstudio:depth"];
      newPerm = newPerm.withState(
        INVISIBLE_STATE_NAMES[i],
        currentDepth < nDepth ? 2 : 0
      );
    }
  }
  return newPerm;
}

/**
 * Refreshes the fluid state for falling (active) fluids.
 * @param {BlockPermutation} perm - The current fluid block permutation.
 * @param {Array<Record<string, any>>} neighborStates - States of horizontal neighbors.
 * @param {boolean} below - Whether there is fluid below.
 * @param {boolean} above - Whether there is fluid above.
 * @param {boolean} isSource - Whether this block is a source fluid.
 * @returns {BlockPermutation} Updated permutation.
 */
function refreshStatesForFalling(perm, neighborStates, below, above, isSource) {
  let newPerm = perm
    .withState(INVISIBLE_STATE_NAMES[4], +above)
    .withState(INVISIBLE_STATE_NAMES[5], +below);
  const currentDepth = perm.getState("lumstudio:depth");
  for (let i = 0; i < 4; i++) {
    const neighbor = neighborStates[i];
    if (neighbor) {
      const nDepth = neighbor["lumstudio:depth"];
      // isMicro indicates a slight difference in depth for fluid thinning.
      const isMicro = (nDepth === currentDepth - 1 - (isSource ? 1 : 0));
      newPerm = newPerm.withState(
        INVISIBLE_STATE_NAMES[i],
        currentDepth < nDepth ? 2 : +isMicro
      );
    }
  }
  return newPerm;
}

import {
  BlockPermutation,
  system,
  world,
  Block,
  BlockComponentRegistry
} from "@minecraft/server";

/*========================================================================
  Utility Functions
========================================================================*/

/**
 * Compares two BlockPermutation objects by comparing all their states.
 * @param {BlockPermutation} perm1 
 * @param {BlockPermutation} perm2 
 * @returns {boolean} True if both permutations have identical states.
 */
function areEqualPermutations(perm1, perm2) {
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();
  return Object.keys(states1).every(key => states1[key] === states2[key]);
}

/**
 * Returns the fluid state string based on a normalized depth value.
 * @param {number} depth - A normalized depth value (0 to 1).
 * @returns {string} Fluid state ("full", "flowing_0", "flowing_1", "flowing_2", "flowing_3", "flowing_4", "flowing_5", or "empty").
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
 * Calculates the slope based on horizontal neighbor blocks.
 * A neighbor is considered "open" if its block is air.
 * @param {Block} b - The fluid block.
 * @returns {string} The calculated slope ("none", "n", "e", "s", "w", "ne", "nw", "se", "sw").
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
      // Ignore errors if neighbor is unloaded.
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
 * Recalculates and returns an updated fluid block permutation based on neighbor conditions.
 * Updates the states: "fluid_state", "slope", and "lumstudio:fluidMode".
 * Also adjusts the geometry identifier (stored in "lumstudio:geom") by appending or removing "_dormant"
 * based on whether the fluid is active (flowing) or dormant.
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
  
  let geom = perm.getState("lumstudio:geom") || "geometry.custom.fluid.oil.12";
  if (mode === "dormant" && !geom.endsWith("_dormant")) {
    geom += "_dormant";
  } else if (mode === "active" && geom.endsWith("_dormant")) {
    geom = geom.replace(/_dormant$/, "");
  }
  perm = perm.withState("lumstudio:geom", geom);
  return perm;
}

/**
 * Updates the fluid block's permutation if its calculated state has changed.
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
  Registration of Custom Fluid Component
========================================================================*/

/**
 * Registers a custom block component "lumstudio:fluidBehavior" that implements fluid behavior.
 * This component updates the block permutation on load, each tick, and when a neighbor changes.
 * It recalculates the fluid state, slope, and mode (active/dormant) and adjusts geometry accordingly.
 */
world.beforeEvents.worldInitialize.subscribe(initEvent => {
  initEvent.blockComponentRegistry.registerCustomComponent("lumstudio:fluidBehavior", {
    
    onLoad: e => {
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
    },
    onTick: e => {
      try {
        updateFluidState(e.block);
      } catch (err) {
        console.error("lumstudio:fluidBehavior onTick error:", err);
      }
    },
    onNeighborChanged: e => {
      try {
        updateFluidState(e.block);
      } catch (err) {
        console.error("lumstudio:fluidBehavior onNeighborChanged error:", err);
      }
    }
  });
});
