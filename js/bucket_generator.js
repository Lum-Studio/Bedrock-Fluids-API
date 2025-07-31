/**
 * @fileoverview This module is dedicated to generating the JSON definition
 * for a custom fluid bucket item. It creates a "tagged" item that the
 * in-game scripts can detect to run the fluid placement logic.
 */

/**
 * Creates the JSON definition for a custom fluid bucket item.
 *
 * This function generates the item's .json file. It does NOT use the
 * `minecraft:block_placer` component, because that component cannot set
 * the necessary block states for a fluid source.
 *
 * Instead, it adds a unique tag to the item (e.g., "placer:lumstudio:liquid_bismuth").
 * The in-game scripts listen for an item with this tag being used, and then
 * manually place the fluid block with the correct states (`depth: 7`, etc.).
 *
 * @param {object} config - The configuration object for the fluid.
 * @param {string} config.id - The identifier of the fluid block (e.g., "lumstudio:liquid_bismuth").
 * @param {string} config.name - The human-readable name of the fluid (e.g., "Liquid Bismuth").
 * @returns {object} A complete and valid JSON object for the bucket item's behavior file.
 */
export function generateBucketItemJson(config) {
    const fluidId = config.id;
    const bucketId = `${fluidId}_bucket`;
    const fluidName = config.name;

    // Define all the components for the bucket item.
    const components = {
        "minecraft:max_stack_size": 1,
        "minecraft:icon": { "texture": bucketId.replace(/:/g, '_') },
        "minecraft:display_name": { "value": `Bucket of ${fluidName}` },
        "minecraft:creative_category": { "parent": "itemGroup.name.bucket" },
        "minecraft:hand_equipped": true,

        // This tag is the key. The scripts look for an item with a tag
        // starting with "placer:" to know when to run the fluid placement logic.
        "minecraft:tags": {
            "tags": [
                `placer:${fluidId}`
            ]
        }
    };

    // Assemble the final JSON structure for the item's behavior file.
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