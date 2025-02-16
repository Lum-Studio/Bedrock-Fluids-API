import { world, system, BlockPermutation, Items, ItemStack } from "@minecraft/server";

const FLUIDS = {
    _stateStore: new WeakMap(),
    _dormantRegistry: new WeakMap(),
    _fluidThresholds: [
        { threshold: 1.0, state: "full" },
        { threshold: 0.75, state: "three_quarters" },
        { threshold: 0.5, state: "half" },
        { threshold: 0.25, state: "quarter" },
        { threshold: 0.0, state: "empty" },
    ],
    _detectionRadius: 10, // Blocks within this radius will update

    onBlockPlaced(event) {
        const block = event.block;
        if (!block) return;
        FLUIDS._stateStore.set(block, { fluidLevel: 1.0, stableTicks: 0, fluidState: "full", slope: "flat" });
    },

    onTick(event) {
        for (const block of world.getDimension("overworld").getEntities({ type: "block" })) {
            if (!FLUIDS._isPlayerNearby(block)) continue; // Skip update if no nearby player
            let state = FLUIDS._stateStore.get(block);
            if (!state) continue;

            state.fluidLevel = Math.max(0, state.fluidLevel - 0.01); // Simulate flow
            state.slope = FLUIDS._computeSlope(block);
            state.fluidState = FLUIDS._getFluidState(state.fluidLevel);
            block.setPermutation(BlockPermutation.resolve(`lumstudio:fluid_${state.fluidState}_${state.slope}`));

            // Convert to dormant if full and stable
            if (state.fluidState === "full" && state.fluidLevel <= 0.1 && state.stableTicks++ > 20) {
                block.setType("lumstudio:fluid_dormant");
                FLUIDS._stateStore.delete(block);
                FLUIDS._dormantRegistry.set(block, "lumstudio:fluid");
            }
        }
    },

    _isPlayerNearby(block) {
        const center = block.center();
        return world.getAllPlayers().some(player => {
            const dx = player.location.x - center.x;
            const dy = player.location.y - center.y;
            const dz = player.location.z - center.z;
            return dx * dx + dy * dy + dz * dz <= FLUIDS._detectionRadius ** 2;
        });
    },

    _computeSlope(block) {
        const directions = ["north", "south", "east", "west"];
        const neighborLevels = directions.map(dir => FLUIDS._getNeighborFluidLevel(block, dir));
        return neighborLevels.some(level => level < block.getComponent("fluid_level")) ? "sloped" : "flat";
    },

    _getNeighborFluidLevel(block, direction) {
        const offset = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] }[direction];
        const neighbor = block.dimension.getBlock(block.location.add(offset));
        const state = FLUIDS._stateStore.get(neighbor);
        return state ? state.fluidLevel : 0;
    },

    _getFluidState(level) {
        return FLUIDS._fluidThresholds.find(({ threshold }) => level >= threshold).state;
    },

    onItemUse(event) {
        const { source, item, block } = event;
        if (item.id !== "minecraft:bucket") return;
        
        let state = FLUIDS._stateStore.get(block);
        if (!state || state.fluidState !== "full") return;

        // Remove block and replace bucket with fluid-filled version
        block.setType("minecraft:air");
        FLUIDS._stateStore.delete(block);
        const fluidBucket = new ItemStack(Items.get("lumstudio:fluid_bucket"), 1);
        source.getComponent("inventory").container.setItem(source.selectedSlot, fluidBucket);
    },
};

world.events.blockPlace.subscribe(event => FLUIDS.onBlockPlaced(event));
system.runInterval(() => FLUIDS.onTick(), 5);
world.events.itemUseOn.subscribe(event => FLUIDS.onItemUse(event));


export default FLUIDS;

// Automatically initialize fluid components.
FLUIDS.init();

// Example usage (in another module):
// FLUIDS.register("cosmos:oil", { decayRate: 0.005, dormantThreshold: 0.1, stableTicksRequired: 40 });
// FLUIDS.registerBucket("cosmos:oil", "mycustom:oil_bucket", "mycustom:oil_bucket_filled");
