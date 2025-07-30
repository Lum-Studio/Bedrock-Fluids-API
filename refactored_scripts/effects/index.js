// effects/index.js
import { apply as applyDamage } from "./damage.js";
import { apply as applyBurn } from "./burn.js";
import { apply as applyStatusEffect } from "./statusEffect.js";
import { apply as applyBoat } from "./boat.js";

/**
 * A map where the key is the property from the FluidRegistry (e.g., "damage")
 * and the value is the function that applies the corresponding effect.
 */
export const effectHandlers = {
    damage: applyDamage,
    burnTime: applyBurn,
    effect: applyStatusEffect,
    boat: applyBoat,
};