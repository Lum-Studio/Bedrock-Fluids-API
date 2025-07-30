const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
                else if (slope === "se") { factorX = 1 - (centerZ / 16); factorZ = 1 - (centerZ / 16); }
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
    const headerUuid = uuidv4();
    const moduleUuid = uuidv4();
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
 * Generates all necessary fluid pack files in a specified directory.
 * @param {object} config The fluid configuration from the frontend.
 * @param {string} outputDir The temporary directory to write files to.
 */
function generateFluidPack(config, outputDir) {
    console.log(`Starting generation for "${config.name}" in ${outputDir}`);
    const safeId = config.id.replace(':', '_');
    const packName = `${config.name} Fluid Pack`;
    const packDesc = `A custom fluid pack for ${config.name} generated by the Bedrock Fluids API.`;

    // Create directory structure
    const bpDir = path.join(outputDir, 'BP');
    const rpDir = path.join(outputDir, 'RP');
    const bpBlocksDir = path.join(bpDir, 'blocks');
    const bpItemsDir = path.join(bpDir, 'items');
    const rpModelsDir = path.join(rpDir, 'models', 'blocks');
    const rpTexturesDir = path.join(rpDir, 'textures', 'blocks');
    const rpItemTexturesDir = path.join(rpDir, 'textures', 'items');

    [bpBlocksDir, bpItemsDir, rpModelsDir, rpTexturesDir, rpItemTexturesDir].forEach(dir => {
        fs.mkdirSync(dir, { recursive: true });
    });

    // 1. Generate and write core assets
    const { geometry, permutations } = generateCoreAssets();
    fs.writeFileSync(path.join(rpModelsDir, 'fluid_geometry.json'), JSON.stringify(geometry, null, 2));
    fs.writeFileSync(path.join(bpBlocksDir, 'fluid_block_permutations.json'), JSON.stringify(permutations, null, 2));

    // 2. Generate and write per-fluid files
    const blockJson = getBlockJson(config);
    const bucketJson = getBucketItemJson(config);
    fs.writeFileSync(path.join(bpBlocksDir, `${safeId}.json`), JSON.stringify(blockJson, null, 2));
    fs.writeFileSync(path.join(bpItemsDir, `${safeId}_bucket.json`), JSON.stringify(bucketJson, null, 2));

    // 3. Generate and write manifest files
    const bpManifest = getManifestJson(packName, packDesc, "data");
    const rpManifest = getManifestJson(packName, packDesc, "resources");
    fs.writeFileSync(path.join(bpDir, 'manifest.json'), JSON.stringify(bpManifest, null, 2));
    fs.writeFileSync(path.join(rpDir, 'manifest.json'), JSON.stringify(rpManifest, null, 2));

    // 4. Generate and write cumulative files
    const blocksJson = { "format_version": [1, 1, 0], [config.id]: { "sound": "bucket.fill_lava", "textures": safeId } };
    fs.writeFileSync(path.join(rpDir, 'blocks.json'), JSON.stringify(blocksJson, null, 2));

    const itemTextureJson = {
        "resource_pack_name": "vanilla", "texture_name": "atlas.items",
        "texture_data": { [`${safeId}_bucket`]: { "textures": `textures/items/${safeId}_bucket` } }
    };
    fs.writeFileSync(path.join(rpDir, 'item_texture.json'), JSON.stringify(itemTextureJson, null, 2));

    const terrainTextureJson = {
        "resource_pack_name": "vanilla", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
        "texture_data": { [safeId]: { "textures": `textures/blocks/${safeId}` } }
    };
    fs.writeFileSync(path.join(rpDir, 'terrain_texture.json'), JSON.stringify(terrainTextureJson, null, 2));

    // 5. Handle texture file (placeholder)
    // The server will handle saving the actual uploaded file here.
    const textureName = config.texture ? config.texture.name : 'default_texture.png';
    const texturePlaceholder = `// Placeholder for ${textureName}`;
    fs.writeFileSync(path.join(rpTexturesDir, `${safeId}.png`), texturePlaceholder);
    fs.writeFileSync(path.join(rpItemTexturesDir, `${safeId}_bucket.png`), "// Placeholder for bucket texture");

    console.log("Fluid pack generation complete.");
}

module.exports = { generateCoreAssets, generateFluidPack };

