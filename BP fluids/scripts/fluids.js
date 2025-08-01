import {
  Direction,
  ItemStack,
  BlockPermutation,
  system,
  world,
} from "@minecraft/server";
import { AIR } from "./API"; // Import AIR constant from the main API

// This flag prevents multi-use bugs with buckets
let currentTickRunned = false;

/**
 * Handles a player using a fluid bucket or an empty bucket on a fluid.
 * @param {ItemStack} itemStack The item being used.
 * @param {Player} player The player using the item.
 * @param {BlockHitInformation} hit The block that was hit.
 */
function placeOrTakeFluid(itemStack, player, hit) {
  const fluidPlacerTag = itemStack.getTags().find((str) => str.startsWith("placer:"));
  if (!hit) return;

  const { face, block } = hit;
  const targetBlock = block.relative(face);

  // Placing fluid
  if (targetBlock.isAir && fluidPlacerTag) {
    const fluidTypeId = fluidPlacerTag.slice(7);
    const fluidPermutation = BlockPermutation.resolve(fluidTypeId);
    
    // Set default properties for the new fluid block
    const finalPermutation = fluidPermutation
        .withState("lumstudio:depth", 7) // Max depth
        .withState("slope", "none")
        .withState("fluid_state", "full")
        .withState("lumstudio:fluidMode", "dormant");

    targetBlock.setPermutation(finalPermutation);
    
    // Replace the fluid bucket with an empty one
    player.getComponent("equippable").setEquipment("Mainhand", new ItemStack("bucket"));
    return;
  }

  // Taking fluid
  const fluidState = targetBlock.permutation.getState("fluid_state");
  if (targetBlock.hasTag("fluid") && fluidState === "full" && itemStack.typeId === "minecraft:bucket") {
    // This assumes the bucket item is named like 'lumstudio:oil_bucket'
    const bucketItem = new ItemStack(`${targetBlock.typeId}_bucket`); 
    
    targetBlock.setPermutation(AIR);
    player.getComponent("equippable").setEquipment("Mainhand", bucketItem);
  }
}

// Listen for item use events (e.g., right-clicking in the air with a bucket)
world.afterEvents.itemUse.subscribe(({ itemStack, source: player }) => {
  const hit = player.getBlockFromViewDirection({
    includePassableBlocks: true,
    maxDistance: 6,
  });
  if (hit) {
    placeOrTakeFluid(itemStack, player, hit);
  }
});

// Listen for item use on a block events (e.g., right-clicking a block with a bucket)
world.beforeEvents.itemUseOn.subscribe((ev) => {
  if (currentTickRunned) {
    ev.cancel = true;
    return;
  };
  currentTickRunned = true;
  placeOrTakeFluid(ev.itemStack, ev.source, { block: ev.block, face: ev.blockFace });
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
      player.runCommand("fog @s push lumstudio:custom_fluid_fog fluid_fog");
    } else {
      player.runCommand("fog @s remove fluid_fog");
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