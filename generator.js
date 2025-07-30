/**
 * @fileoverview This module ports the Python asset generation logic to JavaScript.
 * It is responsible for creating the complex geometry and permutation JSON files
 * needed for the custom fluid simulation.
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

// --- Main Export ---

/**
 * Generates the core, universal fluid asset files as JSON objects.
 * @returns {{geometry: object, permutations: object}}
 */
function generateCoreAssets() {
    console.log("Generating universal fluid assets in memory...");
    const geometry = generateGeometries();
    const permutations = generatePermutations();
    console.log(`Generated ${geometry["minecraft:geometry"].length} geometry models.`);
    console.log(`Generated ${permutations["minecraft:client_block_permutations"].length} permutation entries.`);
    return { geometry, permutations };
}

module.exports = { generateCoreAssets };
