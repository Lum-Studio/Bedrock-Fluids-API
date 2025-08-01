import { world, system, Player , BlockPermutation, ItemStack } from "@minecraft/server";
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

/**
 * Processes a single fluid block update. This function is the core of the fluid simulation logic.
 * @param {import("@minecraft/server").Block} block The block to update.
 */
function fluidUpdate(block) {
    // Ensure the block is valid and has a permutation to work with.
    if (!block || !block.isValid() || !block.permutation) return;

    const currentPermutation = block.permutation;
    const blockStates = currentPermutation.getAllStates();
    const depth = blockStates["lumstudio:depth"];
    const fluidMode = blockStates["lumstudio:fluidMode"];
    const isSourceBlock = depth === MAX_SPREAD_DISTANCE;

    // Determine if the fluid should be flowing downwards.
    // This happens if there's fluid above it or if it's already in an "active" (falling) state.
    const blockAbove = block.above();
    const isFlowingDownward = (blockAbove?.typeId === block.typeId) || (fluidMode === "active");

    // --- 1. Downward Flow ---
    // If the block below is air, the fluid should fall into it.
    const blockBelow = block.below();
    if (blockBelow?.isAir) {
        // Set the block below to be an active, falling fluid.
        const fallingFluidPermutation = currentPermutation.withState("lumstudio:fluidMode", "active");
        blockBelow.setPermutation(fallingFluidPermutation);

        // If the current block is not a source block, remove it as it has flowed downwards.
        if (!isSourceBlock) {
            block.setPermutation(AIR);
        }
        return; // The update is complete for this block.
    }

    // --- 2. Sustainability Check ---
    // Determine if the fluid block should be allowed to exist.
    // A fluid block is sustained if it's a source, has a source above it, or is fed by a neighboring fluid block with a greater depth.
    let canBeSustained = isSourceBlock;
    if (!canBeSustained) {
        if (blockAbove?.typeId === block.typeId) {
            // Check for a source from above
            canBeSustained = true;
        } else {
            // Check for a source from horizontal neighbors
            for (const dir of DIRECTIONS) {
                const neighbor = block.offset(dir);
                if (neighbor?.typeId === block.typeId && neighbor.permutation.getState("lumstudio:depth") > depth) {
                    canBeSustained = true;
                    break;
                }
            }
        }
    }

    // If the block cannot be sustained, it dries up.
    if (!canBeSustained) {
        block.setPermutation(AIR);
        return; // The update is complete for this block.
    }

    // --- 3. Outward Spread ---
    // If the fluid is not falling and has depth, it should spread to adjacent air blocks.
    if (depth > 0 && !isFlowingDownward) {
        const newDepth = depth - 1;
        if (newDepth >= 0) {
            for (const dir of DIRECTIONS) {
                const neighbor = block.offset(dir);
                if (neighbor?.isAir) {
                    const spreadingPermutation = currentPermutation.withState("lumstudio:depth", newDepth);
                    neighbor.setPermutation(spreadingPermutation);
                }
            }
        }
    }

    // --- 4. Final State Update ---
    // Calculate the final visual state (slope, model, etc.) and apply it to the current block.
    const newSlope = calculateSlope(block);
    const newFluidModel = fluidState(depth / MAX_SPREAD_DISTANCE);
    const newMode = isFlowingDownward ? "active" : "dormant";
    
    const newPermutation = currentPermutation.withState("fluid_state", newFluidModel)
                                           .withState("slope", newSlope)
                                           .withState("lumstudio:fluidMode", newMode);

    // Only set the permutation if it has actually changed to avoid unnecessary block updates.
    if (!block.permutation.matches(newPermutation.type, newPermutation.getAllStates())) {
        block.setPermutation(newPermutation);
    }
}

/**
 * Handles the logic for placing fluid from a bucket or picking it up into an empty bucket.
 * This function is called when a player uses an item.
 * @param {ItemStack} itemStack The item that was used.
 * @param {Player} player The player who used the item.
 * @param {import("@minecraft/server").BlockHitInformation} hit The block that was hit by the player's view, or null.
 */
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

import { effectHandlers } from "./effects/index.js";

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

    const entityLocations = new Map();
    const entitiesInFluid = new Set();

    system.runInterval(() => {
        // Part 1: Update the set of entities that are currently in a fluid.
        for (const dimension of world.getDimensions()) {
            for (const entity of dimension.getEntities({})) {
                const lastLocation = entityLocations.get(entity.id);
                const currentLocation = entity.location;

                // Check if the entity has moved to a new block, or if it's the first time we've seen it.
                if (!lastLocation || Math.floor(currentLocation.x) !== Math.floor(lastLocation.x) || Math.floor(currentLocation.y) !== Math.floor(lastLocation.y) || Math.floor(currentLocation.z) !== Math.floor(lastLocation.z)) {
                    entityLocations.set(entity.id, currentLocation); // Update the known location

                    const newBlock = entity.dimension.getBlock(currentLocation);
                    const isInFluid = FluidRegistry[newBlock?.typeId];

                    if (isInFluid) {
                        entitiesInFluid.add(entity.id);
                    } else if (entitiesInFluid.has(entity.id)) {
                        // Entity was in a fluid but is no longer.
                        entitiesInFluid.delete(entity.id);
                        if (entity.typeId === "minecraft:player") {
                            entity.runCommand("fog @s remove fluid_fog");
                        }
                    }
                }
            }
        }

        // Part 2: Apply effects to all entities that are currently in the fluid set.
        for (const entityId of entitiesInFluid) {
            const entity = world.getEntity(entityId);

            // if entity is invalid, remove it from all trackers.
            if (!entity || !entity.isValid()) {
                entitiesInFluid.delete(entityId);
                entityLocations.delete(entityId);
                continue;
            }

            const bodyBlock = entity.dimension.getBlock(entity.location);
            const fluidDataInBody = FluidRegistry[bodyBlock?.typeId];

            // if entity is somehow not in a fluid anymore, remove it.
            if (!fluidDataInBody) {
                entitiesInFluid.delete(entityId);
                if (entity.typeId === "minecraft:player") {
                    entity.runCommand("fog @s remove fluid_fog");
                }
                continue;
            }

            // --- Player-Specific Effects (Fog) ---
            if (entity.typeId === "minecraft:player") {
                const headBlock = entity.getHeadLocation();
                const fluidInHead = entity.dimension.getBlock(headBlock)?.typeId;
                const fluidDataInHead = FluidRegistry[fluidInHead];
                if (fluidDataInHead && fluidDataInHead.fog) {
                    const fogId = `lumstudio:${fluidDataInHead.fog}_fog`;
                    entity.runCommand(`fog @s push ${fogId} fluid_fog`);
                } else {
                    entity.runCommand("fog @s remove fluid_fog");
                }
            }

            // --- General Entity Effects ---
            if (entity.isJumping) {
                entity.addEffect("slow_falling", 5, { showParticles: false, amplifier: 1 });
            }
            const velocity = entity.getVelocity();
            if (velocity.y < 0.05) {
                entity.applyKnockback(0, 0, 0, Math.abs(velocity.y) * 0.3 + (fluidDataInBody.buoyancy || 0));
            }

            // Apply all other effects from the handler system
            for (const key in fluidDataInBody) {
                if (effectHandlers[key]) {
                    try {
                        effectHandlers[key](entity, fluidDataInBody);
                    } catch (e) {
                        console.error(`Error applying effect for key '${key}' on entity ${entity.id}: ${e}`);
                    }
                }
            }
        }
    }, 4); // Run the entire check 5 times a second (every 4 ticks)
}

// Initialize the entire system
initialize();
