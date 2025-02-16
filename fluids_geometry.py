import json

# Configuration parameters
OUTPUT_FILE = "custom_fluid_geometry.json"
FORMAT_VERSION = "1.12.0"
TEXTURE_WIDTH = 64
TEXTURE_HEIGHT = 64
VISIBLE_BOUNDS_WIDTH = 16
VISIBLE_BOUNDS_HEIGHT = 16
VISIBLE_BOUNDS_OFFSET = [0, 0, 0]

# Define depth values as fractions of full height (assuming full block height is 16).
# For example, 1.0 means full (16 blocks high), 0.5 means half-height.
depth_values = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0]

# Define flow directions. "none" means the fluid is not flowing (no rotation).
directions = ["none", "n", "e", "s", "w"]

# Map flow directions to rotations (in degrees). These rotations are applied to the bone.
rotation_map = {
    "n": [0, 180, 0],
    "e": [0, 90, 0],
    "s": [0, 0, 0],
    "w": [0, -90, 0]
}

geometries = []

# For each fluid depth and each flow direction, generate a geometry model.
for depth in depth_values:
    # Compute the fluid's visual height in blocks (assuming full fluid height = 16).
    fluid_height = round(depth * 16)
    # To have the fluid fill from the bottom up, the cube's origin is set so that:
    #   origin.y = full_height - fluid_height.
    origin_y = 16 - fluid_height
    for dire in directions:
        # Construct a unique identifier incorporating the depth (as percentage) and the direction.
        identifier = f"geometry.custom.fluid.oil.{int(depth*100)}_{dire}"
        
        # Define the bone. Here, the bone has one cube:
        #   - origin: [0, origin_y, 0]
        #   - size: [16, fluid_height, 16]
        # This makes the fluid appear to fill from the bottom.
        bone = {
            "name": "fluid",
            "pivot": [8, 8, 8],
            "cubes": [
                {
                    "origin": [0, origin_y, 0],
                    "size": [16, fluid_height, 16],
                    "uv": [0, 0]
                }
            ]
        }
        # If a flow direction is specified (other than "none"), add a rotation.
        if dire != "none":
            bone["rotation"] = rotation_map.get(dire, [0, 0, 0])
        
        # Assemble the geometry model.
        geom = {
            "description": {
                "identifier": identifier,
                "texture_width": TEXTURE_WIDTH,
                "texture_height": TEXTURE_HEIGHT,
                "visible_bounds_width": VISIBLE_BOUNDS_WIDTH,
                "visible_bounds_height": VISIBLE_BOUNDS_HEIGHT,
                "visible_bounds_offset": VISIBLE_BOUNDS_OFFSET
            },
            "bones": [bone]
        }
        geometries.append(geom)

# Build the top-level geometry JSON object.
geometry_json = {
    "format_version": FORMAT_VERSION,
    "minecraft:geometry": geometries
}

# Write the JSON file.
with open(OUTPUT_FILE, "w") as f:
    json.dump(geometry_json, f, indent=2)

print(f"Generated {len(geometries)} geometry models in '{OUTPUT_FILE}'.")
