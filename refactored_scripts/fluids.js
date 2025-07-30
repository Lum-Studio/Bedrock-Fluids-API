import { world, system, Block, BlockPermutation, ItemStack } from "@minecraft/server";
import { BlockUpdate } from "./BlockUpdate.js";
import { FluidQueue } from "./queue.js";

//================================================================//
//                        CONFIGURATION
//================================================================//

import { FluidRegistry } from "./registry.js";

const MAX_SPREAD_DISTANCE = 7;
const UPDATES_PER_TICK = 20;

//================================================================//
//                      CORE IMPLEMENTATION
//================================================================//

const AIR = BlockPermutation.resolve("air");
const DIRECTIONS = [
  { dx: 0, dy: 0, dz: -1, facing: "n" },
  { dx: 1, dy: 0, dz: 0, facing: "e" },
  { dx: 0, dy: 0, dz: 1, facing: "s" },
  { dx: -1, dy: 0, dz: 0, facing: "w" },
];
const Queues = {};
let currentTickRunned = false;

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

function calculateSlope(b) {
  const open = [];
  for (const { dx, dz, facing } of DIRECTIONS) {
    try {
      const neighbor = b.offset({ x: dx, y: 0, z: dz });
      if (neighbor && neighbor.isAir) {
        open.push(facing);
      }
    } catch (e) {}
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

function fluidUpdate(b) {
    if (!b || !b.isValid() || !b.permutation) return;

    const fluidBlock = b.permutation;
    const fluidStates = fluidBlock.getAllStates();
    const depth = fluidStates["lumstudio:depth"];
    const isSource = depth === MAX_SPREAD_DISTANCE;
    
    const hasFluidAbove = b.above()?.typeId === b.typeId;
    let isFallingFluid = hasFluidAbove || fluidStates["lumstudio:fluidMode"] === "active";

    const belowBlock = b.below();
    if (belowBlock?.isAir) {
        const newPerm = fluidBlock.withState("lumstudio:fluidMode", "active");
        belowBlock.setPermutation(newPerm);
        if (!isSource) {
            b.setPermutation(AIR);
        }
        return;
    }

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

    const newSlope = calculateSlope(b);
    const newFluidState = fluidState(depth / MAX_SPREAD_DISTANCE);
    const newMode = isFallingFluid ? "active" : "dormant";
    
    const newPerm = fluidBlock.withState("fluid_state", newFluidState)
                           .withState("slope", newSlope)
                           .withState("lumstudio:fluidMode", newMode);

    if (b.permutation.matches(newPerm.type, newPerm.getAllStates())) {
        b.setPermutation(newPerm);
    }
}

function placeOrTakeFluid(itemStack, player, hit) {
  const fluidPlacerTag = itemStack.getTags().find((str) => str.startsWith("placer:"));
  if (!hit) return;

  const { face, block } = hit;
  const targetBlock = block.relative(face);

  if (targetBlock.isAir && fluidPlacerTag) {
    const fluidTypeId = fluidPlacerTag.slice(7);
    if (!FluidRegistry[fluidTypeId]) return;

    const fluidPermutation = BlockPermutation.resolve(fluidTypeId);
    
    const finalPermutation = fluidPermutation
        .withState("lumstudio:depth", 7)
        .withState("slope", "none")
        .withState("fluid_state", "full")
        .withState("lumstudio:fluidMode", "dormant");

    targetBlock.setPermutation(finalPermutation);
    
    player.getComponent("equippable").setEquipment("Mainhand", new ItemStack("bucket"));
    return;
  }

  const fluidState = targetBlock.permutation?.getState("fluid_state");
  if (targetBlock.hasTag("fluid") && fluidState === "full" && itemStack.typeId === "minecraft:bucket") {
    const bucketItem = new ItemStack(`${targetBlock.typeId}_bucket`); 
    
    targetBlock.setPermutation(AIR);
    player.getComponent("equippable").setEquipment("Mainhand", bucketItem);
  }
}

function initialize() {
    for (const fluidId in FluidRegistry) {
        Queues[fluidId] = new FluidQueue(fluidUpdate, fluidId);
        Queues[fluidId].run(UPDATES_PER_TICK);
    }

    BlockUpdate.on((update) => {
        const block = update.block;
        if (block && block.isValid() && Queues[block.typeId]) {
            Queues[block.typeId].add(block);
        }
    });

    world.afterEvents.itemUse.subscribe(({ itemStack, source: player }) => {
        const hit = player.getBlockFromViewDirection({
            includePassableBlocks: true,
            maxDistance: 6,
        });
        if (hit) {
            placeOrTakeFluid(itemStack, player, hit);
        }
    });

    world.beforeEvents.itemUseOn.subscribe((ev) => {
        if (currentTickRunned) {
            ev.cancel = true;
            return;
        }
        currentTickRunned = true;
        placeOrTakeFluid(ev.itemStack, ev.source, { block: ev.block, face: ev.blockFace });
        system.run(() => {
            currentTickRunned = false;
        });
    });

    system.runInterval(() => {
        for (const player of world.getPlayers()) {
            const headBlock = player.getHeadLocation();
            const bodyBlock = player.location;
            const dimension = player.dimension;
            const fluidId = dimension.getBlock(bodyBlock)?.typeId;
            const fluidData = FluidRegistry[fluidId];

            if (dimension.getBlock(headBlock)?.hasTag("fluid")) {
                player.runCommandAsync(`fog @s push lumstudio:${fluidData?.fog ?? "default"}_fog fluid_fog`);
            } else {
                player.runCommandAsync("fog @s remove fluid_fog");
            }

            if (fluidData) {
                if (player.isJumping) {
                    player.addEffect("slow_falling", 5, { showParticles: false, amplifier: 1 });
                }
                const velocity = player.getVelocity();
                if (velocity.y < 0.05) {
                    player.applyKnockback(0, 0, 0, Math.abs(velocity.y) * 0.3 + (fluidData.buoyancy || 0));
                }
                if (fluidData.damage > 0) {
                    player.applyDamage(fluidData.damage);
                }
                if (fluidData.burnTime > 0) {
                    player.setOnFire(fluidData.burnTime, true);
                }
                if (fluidData.effect) {
                    player.addEffect(fluidData.effect, 20, { showParticles: false });
                }
            }
        }
    }, 2);
}

// Initialize the entire system
initialize();
