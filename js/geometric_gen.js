/**
 * @fileoverview This module ports the Python asset generation logic to JavaScript.
 * It is responsible for creating the complex geometry and permutation JSON files
 * needed for the custom fluid simulation.
 *
 * This version is designed to run in a browser environment.
 */

// --- Configuration Constants ---
const GEOMETRY_FORMAT_VERSION = "1.12.0";
const PERMUTATIONS_FORMAT_VERSION = "1.16.100";

const TEXTURE_WIDTH = 64;
const TEXTURE_HEIGHT = 64;
const VISIBLE_BOUNDS_WIDTH = 16;
const VISIBLE_BOUNDS_HEIGHT = 16;
const VISIBLE_BOUNDS_OFFSET = [0, 0, 0];

const MAX_DEPTH = 8; // Number of fluid levels (from 1 to 8)
const SLOPE_VALUES = ["none", "n", "e", "s", "w", "ne", "nw", "se", "sw"];

// --- Geometry Generation Logic ---

/**
 * Generates a single geometry model for a given fluid depth and slope.
 * @param {number} depthLevel The integer depth of the fluid (1-8).
 * @param {string} slope The slope direction string (e.g., "none", "n", "ne").
 * @returns {object} A JSON object representing the block geometry.
 */
function generateModel(depthLevel, slope) {
    const depthFraction = depthLevel / MAX_DEPTH;
    const fluidHeight = Math.round(depthFraction * 16);
    const identifier = `geometry.lumstudio.fluid.${depthLevel}_${slope}`;

    const model = {
        description: {
            identifier: identifier,
            texture_width: TEXTURE_WIDTH,
            texture_height: TEXTURE_HEIGHT,
            visible_bounds_width: VISIBLE_BOUNDS_WIDTH,
            visible_bounds_height: VISIBLE_BOUNDS_HEIGHT,
            visible_bounds_offset: VISIBLE_BOUNDS_OFFSET,
        },
        bones: [],
    };

    const bone = { name: "fluid", pivot: [0, 0, 0], cubes: [] };

    if (slope === "none" || fluidHeight < 4 || (1 - depthFraction) < 0.01) {
        bone.cubes.push({
            origin: [0, 0, 0],
            size: [16, fluidHeight, 16],
            uv: [0, 0],
        });
        model.bones.push(bone);
        return model;
    }

    const drop = Math.round((1 - depthFraction) * 4);
    const slices = 8;

    if (["n", "s"].includes(slope)) {
        const sliceDepth = Math.floor(16 / slices);
        for (let i = 0; i < slices; i++) {
            const zOrigin = i * sliceDepth;
            const centerZ = zOrigin + sliceDepth / 2;
            const factor = slope === "n" ? centerZ / 16 : 1 - (centerZ / 16);
            const sliceTop = (fluidHeight - drop) + factor * drop;
            const sliceHeight = Math.max(1, Math.round(sliceTop));
            bone.cubes.push({
                origin: [0, 0, zOrigin],
                size: [16, sliceHeight, sliceDepth],
                uv: [0, 0],
            });
        }
    } else if (["e", "w"].includes(slope)) {
        const sliceWidth = Math.floor(16 / slices);
        for (let i = 0; i < slices; i++) {
            const xOrigin = i * sliceWidth;
            const centerX = xOrigin + sliceWidth / 2;
            const factor = slope === "w" ? centerX / 16 : 1 - (centerX / 16);
            const sliceTop = (fluidHeight - drop) + factor * drop;
            const sliceHeight = Math.max(1, Math.round(sliceTop));
            bone.cubes.push({
                origin: [xOrigin, 0, 0],
                size: [sliceWidth, sliceHeight, 16],
                uv: [0, 0],
            });
        }
    } else if (["ne", "nw", "se", "sw"].includes(slope)) {
        const diagSlices = 4;
        const sliceSize = Math.floor(16 / diagSlices);
        for (let i = 0; i < diagSlices; i++) {
            for (let j = 0; j < diagSlices; j++) {
                const xOrigin = i * sliceSize;
                const zOrigin = j * sliceSize;
                const centerX = xOrigin + sliceSize / 2;
                const centerZ = zOrigin + sliceSize / 2;
                let factorX, factorZ;

                if (slope === "ne") { factorX = 1 - (centerX / 16); factorZ = centerZ / 16; }
                else if (slope === "nw") { factorX = centerX / 16; factorZ = centerZ / 16; }
                else if (slope === "se") { factorX = 1 - (centerX / 16); factorZ = 1 - (centerZ / 16); }
                else if (slope === "sw") { factorX = centerX / 16; factorZ = 1 - (centerZ / 16); }

                const factor = (factorX + factorZ) / 2;
                const sliceTop = (fluidHeight - drop) + factor * drop;
                const sliceHeight = Math.max(1, Math.round(sliceTop));
                bone.cubes.push({
                    origin: [xOrigin, 0, zOrigin],
                    size: [sliceSize, sliceHeight, sliceSize],
                    uv: [0, 0],
                });
            }
        }
    }

    model.bones.push(bone);
    return model;
}

/**
 * Generates the complete fluid_geometry.json object.
 * @returns {object}
 */
function generateGeometries() {
    const geometryModels = [];
    for (let depthLevel = 1; depthLevel <= MAX_DEPTH; depthLevel++) {
        for (const slope of SLOPE_VALUES) {
            geometryModels.push(generateModel(depthLevel, slope));
        }
    }
    return {
        "format_version": GEOMETRY_FORMAT_VERSION,
        "minecraft:geometry": geometryModels,
    };
}

// --- Permutation Generation Logic ---

/**
 * Converts an integer depth level (1-8) to a fluid state string.
 * @param {number} depthLevel
 * @returns {string}
 */
function fluidStateFromLevel(depthLevel) {
    const depthFraction = depthLevel / MAX_DEPTH;
    const thresholds = [
        [0.875, "full"], [0.75, "flowing_0"], [0.625, "flowing_1"],
        [0.5, "flowing_2"], [0.375, "flowing_3"], [0.25, "flowing_4"],
        [0.125, "flowing_5"],
    ];
    for (const [thresh, state] of thresholds) {
        if (depthFraction >= thresh) return state;
    }
    return "empty";
}

/**
 * Generates the array of permutation objects.
 * @returns {Array<object>}
 */
function generatePermutations(namespace) {
    const permutations = [];
    for (let depthLevel = 1; depthLevel <= MAX_DEPTH; depthLevel++) {
        for (const slope of SLOPE_VALUES) {
            const geomId = `geometry.lumstudio.fluid.${depthLevel}_${slope}`;
            const condition = `q.block_state('lumstudio:depth') == ${depthLevel - 1} && q.block_state('${namespace}:slope') == '${slope}'`;
            permutations.push({
                condition: condition,
                components: {
                    "minecraft:geometry": geomId,
                    "minecraft:material_instances": {
                        "*": {
                            "texture": "this_is_a_temporary_placeholder",
                            "render_method": "blend"
                        }
                    }
                },
            });
        }
    }
    return permutations;
}

// --- File Generation Logic ---

/**
 * Creates the JSON for the fluid's block definition file using the BlockGenerator API.
 * @param {object} config The fluid configuration from the frontend.
 * @returns {object}
 */
function getBlockJson(config) {
    const fluidId = config.id;
    const namespace = fluidId.split(':')[0];
    const safeId = fluidId.replace(':', '_');

    const generator = new BlockGenerator("1.21.10", fluidId);

    // Add properties
    generator
        .addProperty("lumstudio:depth", [0, 1, 2, 3, 4, 5, 6, 7])
        .addProperty(`${namespace}:slope`, ["none", "n", "e", "s", "w", "ne", "nw", "se", "sw"])
        .addProperty(`${namespace}:fluid_state`, ["full", "flowing_0", "flowing_1", "flowing_2", "flowing_3", "flowing_4", "flowing_5", "empty"])
        .addProperty("lumstudio:fluidMode", ["dormant", "active"]);

    // Add base components
    generator
        .addComponent("minecraft:tags", { "tags": ["fluid", safeId] })
        .addComponent("minecraft:material_instances", {
            "*": {
                "texture": safeId,
                "render_method": "blend",
                "face_dimming": false,
                "ambient_occlusion": false,
                "fog_color": config.fogColor
            }
        })
        .addComponent("minecraft:geometry", "geometry.lumstudio.fluid.8_none")
        .addComponent("minecraft:placement_filter", {
            "conditions": [{ "allowed_faces": ["up", "down", "north", "south", "east", "west"] }]
        })
        .addComponent("minecraft:loot", "loot_tables/empty.json")
        .addComponent("minecraft:destructible_by_mining", { "seconds_to_destroy": 100 })
        .addComponent("minecraft:destructible_by_explosion", { "explosion_resistance": 500 });

    if (config.supportsBoats) {
        generator.addComponent("minecraft:boat_passable", {});
    }
    if (config.lightLevel && config.lightLevel > 0) {
        generator.addComponent("minecraft:light_emission", config.lightLevel);
    }

    // Add permutations for geometry based on depth and slope
    for (let depthLevel = 1; depthLevel <= MAX_DEPTH; depthLevel++) {
        for (const slope of SLOPE_VALUES) {
            const geomId = `geometry.lumstudio.fluid.${depthLevel}_${slope}`;
            const condition = `q.block_state('lumstudio:depth') == ${depthLevel - 1} && q.block_state('${namespace}:slope') == '${slope}'`;
            generator.addPermutation(condition, {
                "minecraft:geometry": geomId
            });
        }
    }

    return generator.build();
}

/**
 * Creates the JSON for the fluid's bucket item.
 * @param {object} config The fluid configuration from the frontend.
 * @returns {object}
 */
function getBucketItemJson(config) {
    const fluidId = config.id;
    const namespace = fluidId.split(':')[0];
    const bucketId = `${fluidId}_bucket`;
    const fluidName = config.name;

    const components = {
        "minecraft:max_stack_size": 1,
        "minecraft:icon": { "texture": bucketId.replace(':', '_') },
        "minecraft:display_name": { "value": `Bucket of ${fluidName}` },
        "minecraft:creative_category": { "parent": "itemGroup.name.bucket" },
        "minecraft:hand_equipped": true,
        "minecraft:block_placer": {
            "block": {
                "name": fluidId,
                "states": {
                    "lumstudio:depth": 7,
                    [`${namespace}:slope`]: "none",
                    [`${namespace}:fluid_state`]: "full",
                    "lumstudio:fluidMode": "dormant"
                }
            }
        }
    };

    return {
        "format_version": "1.20.10",
        "minecraft:item": {
            "description": {
                "identifier": bucketId,
                "category": "Items"
            },
            "components": components
        }
    };
}

/**
 * Creates the JSON for a pack manifest file.
 * @param {string} name The name of the pack.
 * @param {string} description A description for the pack.
 * @param {string} type The type of pack ('data' for BP, 'resources' for RP).
 * @returns {object}
 */
function getManifestJson(name, description, type) {
    const headerUuid = uuid.v4(); // Using the global uuid object from the CDN
    const moduleUuid = uuid.v4();
    return {
        "format_version": 2,
        "header": {
            "name": name,
            "description": description,
            "uuid": headerUuid,
            "version": [1, 0, 0],
            "min_engine_version": [1, 19, 0]
        },
        "modules": [
            {
                "type": type,
                "uuid": moduleUuid,
                "version": [1, 0, 0]
            }
        ]
    };
}

/**
 * Creates the JavaScript code for the fluid's dynamic properties.
 * @param {object} config The fluid configuration from the frontend.
 * @returns {string}
 */
function getFluidConfigScript(config) {
    return `// ---- THIS FILE IS AUTO-GENERATED. DO NOT EDIT. ----
export const fluidConfig = {
    buoyancy: ${config.buoyancy},
    damage: ${config.damage},
    effect: "${config.effect || ''}",
    burnsEntities: ${config.burnsEntities}
};
`;
}

/**
 * Creates the JavaScript code for registering the fluid queues.
 * This is a separate file that will be imported by the main API.
 * @param {object} config The fluid configuration from the frontend.
 * @returns {string}
 */
function getRegistrationScript(config) {
    const fluidId = config.id;
    const tickDelay = config.tickDelay || 20; // Default to 20 if not provided

    return `// ---- THIS FILE IS AUTO-GENERATED. DO NOT EDIT. ----
import { FluidQueue } from "../queue";
import { fluidUpdate } from "../API";

export const Queues = {
  "${fluidId}": new FluidQueue(fluidUpdate, "${fluidId}", ${tickDelay}),
};
`;
}
