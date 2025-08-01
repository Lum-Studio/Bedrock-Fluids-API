// --- CORE GENERATOR FUNCTIONS ---

/**
 * Generates the content for the dynamic registry.js file.
 * @param {object} config The fluid configuration from the user.
 * @returns {string} The string content of the registry.js file.
 */
function getRegistryScript(config) {
    const fluidId = config.id;
    const registry = {
        [fluidId]: {
            damage: config.damage,
            fog: config.fogColor.substring(1), // Store hex without '#'
            buoyancy: config.buoyancy,
            boat: config.supportsBoats,
        }
    };

    if (config.burnsEntities) {
        registry[fluidId].burnTime = 5; // Default burn time of 5 seconds
    }

    if (config.effect && config.effect !== "") {
        registry[fluidId].effect = config.effect;
    }

    return `export const FluidRegistry = ${JSON.stringify(registry, null, 2)};`;
}

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
