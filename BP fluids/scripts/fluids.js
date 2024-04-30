import {
  Direction,
  ItemStack,
  BlockPermutation,
  system,
  world,
  Block,
} from "@minecraft/server";
import { FluidQueue } from "./queue";

const air = BlockPermutation.resolve("air");
const directionNums = {
  "n": 0,
  "none": 0,
  "e": 1,
  "s": 2,
  "w": 3,
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
  // Spreading

  // It is not deleted because i didn't write this code
  // Go in all directions
  // TODO: Make it attempt to go in all directions if no obstructions
  // for (const dir of directions) {
  //   let spreadDistance = 0;
  //   let currentBlock = b;
  //   while (spreadDistance < maxSpreadDistance) {
  //     const currentX = currentBlock.location.x + dir.dx;
  //     const currentY = currentBlock.location.y + dir.dy;
  //     const currentZ = currentBlock.location.z + dir.dz;
  //     const neighbor = dimension.getBlock(currentX, currentY, currentZ);
  //     const neighborDir = fluidBlock.withState(
  //       "lumstudio:direction",
  //       dir.facing
  //     );
  //     neighbor.setPermutation(neighborDir);
  //     if (neighbor.hasTag("fluid") && neighbor !== b) {
  //       const neighborPerm = neighbor.permutation;
  //       const depth = neighborPerm.getState("lumstudio:depth") || 0;
  //       if (depth > 0) {
  //         neighbor.setPermutation(
  //           neighborPerm.withState("lumstudio:depth", depth - 1)
  //         );
  //       }
  //     }

  //     // Stop spreading if a non-fluid block is encountered
  //     if (!neighbor.isAir && !neighbor.hasTag("fluid")) {
  //       break;
  //     }

  //     // Move to the next neighboring block in the current direction
  //     currentBlock = neighbor;
  //     spreadDistance++;
  //   }
  // }
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
