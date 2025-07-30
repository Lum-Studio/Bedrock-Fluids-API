// --- SCRIPT TEMPLATES FOR THE NEW, REFACTORED ENGINE ---

const SCRIPTS = {
    "main.js": `import "./fluids.js";`,
    "fluids.js": `import { world, system, Block, BlockPermutation, ItemStack } from "@minecraft/server";
import { BlockUpdate } from "./BlockUpdate.js";
import { FluidQueue } from "./queue.js";
import { FluidRegistry } from "./registry.js";
import { effectHandlers } from "./effects/index.js";

const MAX_SPREAD_DISTANCE = 7;
const UPDATES_PER_TICK = 20;
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
      if (neighbor && neighbor.isAir) open.push(facing);
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
        if (!isSource) b.setPermutation(AIR);
        return;
    }
    let canBeSustained = false;
    if (isSource) canBeSustained = true;
    else {
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
    const newPerm = fluidBlock.withState("fluid_state", newFluidState).withState("slope", newSlope).withState("lumstudio:fluidMode", newMode);
    if (b.permutation.matches(newPerm.type, newPerm.getAllStates())) b.setPermutation(newPerm);
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
    const finalPermutation = fluidPermutation.withState("lumstudio:depth", 7).withState("slope", "none").withState("fluid_state", "full").withState("lumstudio:fluidMode", "dormant");
    targetBlock.setPermutation(finalPermutation);
    player.getComponent("equippable").setEquipment("Mainhand", new ItemStack("bucket"));
    return;
  }
  const fluidState = targetBlock.permutation?.getState("fluid_state");
  if (targetBlock.hasTag("fluid") && fluidState === "full" && itemStack.typeId === "minecraft:bucket") {
    const bucketItem = new ItemStack(`\${targetBlock.typeId}_bucket`);
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
        if (block && block.isValid() && Queues[block.typeId]) Queues[block.typeId].add(block);
    });
    world.afterEvents.itemUse.subscribe(({ itemStack, source: player }) => {
        const hit = player.getBlockFromViewDirection({ includePassableBlocks: true, maxDistance: 6 });
        if (hit) placeOrTakeFluid(itemStack, player, hit);
    });
    world.beforeEvents.itemUseOn.subscribe((ev) => {
        if (currentTickRunned) {
            ev.cancel = true;
            return;
        }
        currentTickRunned = true;
        placeOrTakeFluid(ev.itemStack, ev.source, { block: ev.block, face: ev.blockFace });
        system.run(() => { currentTickRunned = false; });
    });
    system.runInterval(() => {
        const players = world.getPlayers();
        const processedEntities = new Set();
        for (const player of players) {
            const dimension = player.dimension;
            const entitiesInRadius = dimension.getEntities({ location: player.location, maxDistance: 64 });
            const headBlock = player.getHeadLocation();
            const fluidInHead = dimension.getBlock(headBlock)?.typeId;
            const fluidDataInHead = FluidRegistry[fluidInHead];
            if (fluidDataInHead) player.runCommandAsync(`fog @s push lumstudio:\${fluidDataInHead.fog ?? "default"}_fog fluid_fog`);
            else player.runCommandAsync("fog @s remove fluid_fog");
            for (const entity of entitiesInRadius) {
                if (processedEntities.has(entity.id)) continue;
                processedEntities.add(entity.id);
                const bodyBlock = entity.location;
                const fluidInBody = dimension.getBlock(bodyBlock)?.typeId;
                const fluidDataInBody = FluidRegistry[fluidInBody];
                if (fluidDataInBody) {
                    if (entity.isJumping) entity.addEffect("slow_falling", 5, { showParticles: false, amplifier: 1 });
                    const velocity = entity.getVelocity();
                    if (velocity.y < 0.05) entity.applyKnockback(0, 0, 0, Math.abs(velocity.y) * 0.3 + (fluidDataInBody.buoyancy || 0));
                    for (const key in fluidDataInBody) {
                        if (effectHandlers[key]) {
                            try {
                                effectHandlers[key](entity, fluidDataInBody);
                            } catch (e) {
                                console.error(`Error applying effect for key '\${key}' on entity \${entity.id}: \${e}`);
                            }
                        }
                    }
                }
            }
        }
    }, 2);
}
initialize();`,
    "registry.js": `export const FluidRegistry = {
  "lumstudio:super_hot_magma": {
    damage: 2,
    burnTime: 5,
    fog: "orange",
    buoyancy: -0.02,
    boat: false,
  },
  "lumstudio:distilled_water": {
    damage: 0,
    fog: "blue",
    buoyancy: 0.03,
    boat: true,
  },
  "lumstudio:liquid_bismuth": {
    damage: 0,
    fog: "gray",
    buoyancy: -0.01,
    effect: "slowness",
    boat: false,
  },
};`,
    "BlockUpdate.js": `import { world, system, Block, Dimension } from "@minecraft/server";
export { BlockUpdate };
const Events = {};
const Offsets = [ { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 } ];
let LastEventId = -1;
class BlockUpdate {
  #block; #source;
  constructor(data) { this.#block = data.block; this.#source = data.source; }
  get block() { return this.#block; }
  get source() { return this.#source; }
  static on(callback) { LastEventId++; const id = LastEventId + ""; Events[id] = callback; return id; }
  static off(id) { delete Events[id]; }
  static trigger(source) { for (const offset of Offsets) { let block; try { block = source.offset(offset); } catch {} if (block !== undefined) BlockUpdate.triggerEvents({ block, source }); } }
  static triggerEvents(data) { const update = new BlockUpdate(data); Object.values(Events).forEach((callback) => callback(update)); }
}
const easyTrigger = (data) => BlockUpdate.trigger(data.block);
world.beforeEvents.playerInteractWithBlock.subscribe((data) => { if (!data.isFirstEvent) return; system.run(() => { if (!data.block.isValid || data.cancel) return; BlockUpdate.trigger(data.block); }); });
world.afterEvents.playerBreakBlock.subscribe(easyTrigger);
world.afterEvents.buttonPush.subscribe(easyTrigger);
world.afterEvents.leverAction.subscribe(easyTrigger);
world.afterEvents.pistonActivate.subscribe(easyTrigger);
world.afterEvents.playerPlaceBlock.subscribe(easyTrigger);
world.afterEvents.pressurePlatePop.subscribe(easyTrigger);
world.afterEvents.pressurePlatePush.subscribe(easyTrigger);
world.afterEvents.tripWireTrip.subscribe(easyTrigger);
world.afterEvents.projectileHitBlock.subscribe((data) => { BlockUpdate.trigger(data.getBlockHit().block); });
world.afterEvents.explosion.subscribe((data) => { const triggeredBlocks = data.getImpactedBlocks().slice(); const initialLength = triggeredBlocks.length; for (let i = 0; i < initialLength; i++) { const source = triggeredBlocks[i]; BlockUpdate.triggerEvents({ block: source }); for (const offset of Offsets) { let neighbor; try { neighbor = source.offset(offset); } catch {} if (neighbor !== undefined && !triggeredBlocks.includes(neighbor)) { triggeredBlocks.push(neighbor); BlockUpdate.triggerEvents({ block: neighbor, source }); } } } });
const OriginalMethods = [ { class: Block, name: "setType" }, { class: Block, name: "setPermutation" }, { class: Block, name: "setWaterlogged" }, { class: Dimension, name: "setBlockType" }, { class: Dimension, name: "setBlockPermutation" } ];
for (const data of OriginalMethods) { data.method = data.class.prototype[data.name]; data.class.prototype[data.name] = function (arg1, arg2) { if (this instanceof Dimension) { data.method.bind(this)(arg1, arg2); const block = this.getBlock(arg1); if (block !== undefined) BlockUpdate.trigger(block); } else { data.method.bind(this)(arg1); BlockUpdate.trigger(this); } }; }`,
    "queue.js": `import { system } from "@minecraft/server";
export class FluidQueue {
    #marked = new Set(); #optimized = []; #instant = []; #isRunning = false; #runId;
    constructor(operation, blockTypeId) { if (typeof operation !== 'function' || operation.length !== 1) throw new Error("Operation should be a function with one parameter"); this.type = blockTypeId; this.blockOperation = operation; }
    add(block) { if (!this.#isRunning) console.warn("§cThe fluid queue is stopped, you can't use any methods"); else if (block.typeId === this.type) { if (this.#marked.has(block)) { this.#instant.push(block); this.#marked.delete(block); const index = this.#optimized.findIndex((v) => v === block); if (index !== -1) this.#optimized.splice(index, 1); } else this.#optimized.push(block); } }
    skipQueueFor(block) { this.#marked.add(block); }
    run(countPerTick) { this.stop(); this.#runId = system.runInterval(() => { for (const block of this.#instant) { try { this.blockOperation(block); } catch (error) { console.error(`FluidQueue of \${this.type}: Instant: \${error}`); } } this.#instant.length = 0; for (let iteration = 0; iteration < countPerTick; iteration++) { if (this.#optimized.length === 0) break; const block = this.#optimized.shift(); if (!block?.typeId || block.typeId !== this.type) continue; try { this.blockOperation(block); } catch (error) { console.error(`FluidQueue of \${this.type}: Ticking: Iteration #\${iteration}: \${error}`); } } }, 0); this.#isRunning = true; }
    stop() { if (this.#isRunning) { system.clearRun(this.#runId); this.#isRunning = false; } }
}`,
    "effects/index.js": `import { apply as applyDamage } from "./damage.js";
import { apply as applyBurn } from "./burn.js";
import { apply as applyStatusEffect } from "./statusEffect.js";
import { apply as applyBoat } from "./boat.js";
export const effectHandlers = {
    damage: applyDamage,
    burnTime: applyBurn,
    effect: applyStatusEffect,
    boat: applyBoat,
};`,
    "effects/damage.js": `export function apply(entity, fluidData) { if (fluidData.damage > 0 && entity.hasComponent("minecraft:health")) entity.applyDamage(fluidData.damage); }`,
    "effects/burn.js": `export function apply(entity, fluidData) { if (fluidData.burnTime > 0) entity.setOnFire(fluidData.burnTime, true); }`,
    "effects/statusEffect.js": `export function apply(entity, fluidData) { if (fluidData.effect) entity.addEffect(fluidData.effect, 40, { showParticles: false }); }`,
    "effects/boat.js": `export function apply(entity, fluidData) { if (entity.typeId === "minecraft:boat" && fluidData.boat) entity.applyImpulse({ x: 0, y: 0.04, z: 0 }); }`,
};

// --- CORE GENERATOR FUNCTIONS ---

function getManifestJson(packName, packDesc, type) {
    const headerUuid = uuid.v4();
    const base = {
        format_version: 2,
        header: {
            name: packName,
            description: packDesc,
            uuid: headerUuid,
            version: [1, 0, 0],
            min_engine_version: [1, 20, 60]
        },
        modules: []
    };

    if (type === 'resources') {
        base.modules.push({
            description: "Resources",
            type: "resources",
            uuid: uuid.v4(),
            version: [1, 0, 0]
        });
    } else { // Behavior Pack
        base.modules.push({
            description: "Data",
            type: "data",
            uuid: uuid.v4(),
            version: [1, 0, 0]
        });
        base.modules.push({
            description: "Scripts",
            type: "script",
            language: "javascript",
            uuid: uuid.v4(),
            version: [1, 0, 0],
            entry: "scripts/main.js"
        });
        base.dependencies = [
            {
                "module_name": "@minecraft/server",
                "version": "1.12.0-beta"
            }
        ];
    }
    return base;
}

// Note: The actual implementation of getBlockJson, getBucketItemJson, etc.
// are now correctly handled by the imported geometric_gen.js script.
