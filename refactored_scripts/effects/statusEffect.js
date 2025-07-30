
// effects/statusEffect.js
export function apply(entity, fluidData) {
    if (fluidData.effect) {
        // Duration is in ticks (20 ticks = 1 second)
        entity.addEffect(fluidData.effect, 40, { showParticles: false });
    }
}
