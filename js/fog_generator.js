/**
 * @fileoverview A modular API for generating Minecraft Bedrock fog setting JSON files.
 */

class FogGenerator {
    /**
     * @param {string} identifier The identifier for the fog setting (e.g., 'lumstudio:custom_fog').
     */
    constructor(identifier) {
        if (!identifier) {
            throw new Error('Fog identifier is required.');
        }
        this.fog = {
            "format_version": "1.16.100",
            "minecraft:fog_settings": {
                "description": {
                    "identifier": identifier
                },
                "distance": {}
            }
        };
        this.distance = this.fog["minecraft:fog_settings"].distance;
    }

    /**
     * Sets the distance-based fog properties for a specific medium (air, water, weather, etc.).
     * @param {string} medium The medium for the fog (e.g., 'air', 'water').
     * @param {number} start The distance at which the fog starts.
     * @param {number} end The distance at which the fog is at its maximum density.
     * @param {string} color The hex color code for the fog.
     * @param {string} [renderType='fixed'] The render distance type.
     * @returns {FogGenerator} The current instance for chaining.
     */
    setDistance(medium, start, end, color, renderType = 'fixed') {
        this.distance[medium] = {
            "fog_start": start,
            "fog_end": end,
            "fog_color": color,
            "render_distance_type": renderType
        };
        return this;
    }

    /**
     * Builds and returns the final fog JSON object.
     * @returns {object} The complete fog settings JSON.
     */
    build() {
        return this.fog;
    }
}
