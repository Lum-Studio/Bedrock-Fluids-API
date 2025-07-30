// effects/boat.js
/**
 * Applies custom buoyancy physics to boats.
 * @param {import("@minecraft/server").Entity} entity The entity to apply the effect to.
 * @param {object} fluidData The data object for the fluid from the FluidRegistry.
 */
export function apply(entity, fluidData) {
    // Check if the entity is a boat and the fluid is configured to support it.
    if (entity.typeId === "minecraft:boat" && fluidData.boat) {
        // Apply a gentle upward impulse to simulate floating.
        // This value may need tweaking for the right feel.
        entity.applyImpulse({ x: 0, y: 0.04, z: 0 });
    }
}