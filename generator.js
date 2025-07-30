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
 * Generates the complete fluid_block_permutations.json object.
 * @returns {object}
 */
function generatePermutations() {
    const permutations = [];
    for (let depthLevel = 1; depthLevel <= MAX_DEPTH; depthLevel++) {
        const stateName = fluidStateFromLevel(depthLevel);
        for (const slope of SLOPE_VALUES) {
            const geomId = `geometry.lumstudio.fluid.${depthLevel}_${slope}`;
            const condition = `q.block_state('lumstudio:depth') == ${depthLevel - 1} && q.block_state('slope') == '${slope}'`;
            permutations.push({
                condition: condition,
                components: {
                    "minecraft:geometry": geomId,
                    "minecraft:block_state": {
                        "fluid_state": stateName,
                    },
                },
            });
        }
    }
    return {
        "format_version": PERMUTATIONS_FORMAT_VERSION,
        "minecraft:client_block_permutations": permutations,
    };
}

// --- File Generation Logic ---

/**
 * Creates the JSON for the fluid's block definition file.
 * @param {object} config The fluid configuration from the frontend.
 * @returns {object}
 */
function getBlockJson(config) {
    const fluidId = config.id; // e.g., "lumstudio:oil"
    const safeId = fluidId.replace(':', '_');

    const components = {
        "minecraft:material_instances": {
            "*": {
                "texture": safeId, // Dynamic texture
                "render_method": "blend"
            }
        },
        "minecraft:geometry": "geometry.lumstudio.fluid.8_none",
        "minecraft:placement_filter": {
            "conditions": [
                {
                    "allowed_faces": ["up", "down", "north", "south", "east", "west"]
                }
            ]
        },
        "minecraft:loot": "loot_tables/empty.json",
        "minecraft:destructible_by_mining": { "seconds_to_destroy": 100 },
        "minecraft:destructible_by_explosion": { "explosion_resistance": 500 },
        "tag:fluid": {}
    };
    // Dynamically add the specific fluid tag
    components[`tag:${safeId}`] = {};

    return {
        "format_version": "1.19.70",
        "minecraft:block": {
            "description": {
                "identifier": fluidId,
                "properties": {
                    "lumstudio:depth": [0, 1, 2, 3, 4, 5, 6, 7],
                    "slope": ["none", "n", "e", "s", "w", "ne", "nw", "se", "sw"],
                    "fluid_state": ["full", "flowing_0", "flowing_1", "flowing_2", "flowing_3", "flowing_4", "flowing_5", "empty"],
                    "lumstudio:fluidMode": ["dormant", "active"]
                }
            },
            "components": components,
            "permutations": [
                // Permutations are now in a separate file
            ]
        }
    };
}

/**
 * Creates the JSON for the fluid's bucket item.
 * @param {object} config The fluid configuration from the frontend.
 * @returns {object}
 */
function getBucketItemJson(config) {
    const fluidId = config.id; // e.g., "lumstudio:oil"
    const bucketId = `${fluidId}_bucket`; // e.g., "lumstudio:oil_bucket"
    const fluidName = config.name; // e.g., "Oil"

    const components = {
        "minecraft:max_stack_size": 1,
        "minecraft:icon": { "texture": bucketId.replace(':', '_') },
        "minecraft:display_name": { "value": `Bucket of ${fluidName}` },
        "minecraft:creative_category": { "parent": "itemGroup.name.bucket" },
        "minecraft:hand_equipped": true,
        "minecraft:use_duration": 1,
        "minecraft:food": { "can_always_eat": true }, // This is a trick to get a use event
        "minecraft:use_animation": "drink"
    };
    // Dynamically add the placer tag
    components[`tag:placer:${fluidId}`] = {};

    return {
        "format_version": "1.16.100",
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