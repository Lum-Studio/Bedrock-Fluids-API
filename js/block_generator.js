/**
 * @fileoverview A modular API for generating Minecraft Bedrock block JSON definitions.
 * This provides a clean, chainable interface for building complex block JSON.
 */

class BlockGenerator {
    /**
     * @param {string} formatVersion The format version for the block file.
     * @param {string} identifier The identifier for the block (e.g., 'wiki:custom_block').
     */
    constructor(formatVersion, identifier) {
        if (!formatVersion || !identifier) {
            throw new Error('Format version and identifier are required.');
        }
        this.block = {
            "format_version": formatVersion,
            "minecraft:block": {
                "description": {
                    "identifier": identifier,
                    "properties": {}
                },
                "components": {},
                "permutations": []
            }
        };
        // Convenience references to the inner parts of the JSON structure
        this.description = this.block["minecraft:block"].description;
        this.components = this.block["minecraft:block"].components;
        this.permutations = this.block["minecraft:block"].permutations;
    }

    /**
     * Adds a property (state) to the block's description.
     * @param {string} name The name of the property (e.g., 'wiki:my_state').
     * @param {Array<string|number|boolean>} values An array of possible values for the state.
     * @returns {BlockGenerator} The current instance for chaining.
     */
    addProperty(name, values) {
        this.description.properties[name] = values;
        return this;
    }

    /**
     * Adds a component to the base component list of the block.
     * @param {string} name The name of the component (e.g., 'minecraft:friction').
     * @param {object} definition The JSON definition for the component.
     * @returns {BlockGenerator} The current instance for chaining.
     */
    addComponent(name, definition) {
        this.components[name] = definition;
        return this;
    }

    /**
     * Adds a permutation to the block.
     * @param {string} condition The Molang condition for this permutation to be active.
     * @param {object} components An object defining the components to apply when the condition is met.
     * @returns {BlockGenerator} The current instance for chaining.
     */
    addPermutation(condition, components) {
        this.permutations.push({
            condition: condition,
            components: components
        });
        return this;
    }

    /**
     * Builds and returns the final block JSON object.
     * It cleans up empty fields for a tidier output file.
     * @returns {object} The complete block JSON.
     */
    build() {
        if (Object.keys(this.description.properties).length === 0) {
            delete this.description.properties;
        }
        if (Object.keys(this.components).length === 0) {
            delete this.block["minecraft:block"].components;
        }
        if (this.permutations.length === 0) {
            delete this.block["minecraft:block"].permutations;
        }
        return this.block;
    }
}
