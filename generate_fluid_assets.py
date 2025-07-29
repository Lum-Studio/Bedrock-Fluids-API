import json
import math

# --- Configuration ---
GEOMETRY_OUTPUT_FILE = "fluid_geometry.json"
PERMUTATIONS_OUTPUT_FILE = "fluid_block_permutations.json"

GEOMETRY_FORMAT_VERSION = "1.12.0"
PERMUTATIONS_FORMAT_VERSION = "1.16.100"

TEXTURE_WIDTH = 64
TEXTURE_HEIGHT = 64
VISIBLE_BOUNDS_WIDTH = 16
VISIBLE_BOUNDS_HEIGHT = 16
VISIBLE_BOUNDS_OFFSET = [0, 0, 0]

# Shared values for both generators
MAX_DEPTH = 8 # Number of fluid levels (from 1 to 8)
SLOPE_VALUES = ["none", "n", "e", "s", "w", "ne", "nw", "se", "sw"]

# --- Geometry Generation Logic (from fluids_geometry.py) ---

def generate_model(depth_level, slope):
    """
    Generates a geometry model for a given fluid depth and slope state.
    """
    depth_fraction = depth_level / float(MAX_DEPTH)
    fluid_height = round(depth_fraction * 16)
    # Use the integer depth level for an identifier
    identifier = f"geometry.lumstudio.fluid.{depth_level}_{slope}"
    
    model = {
        "description": {
            "identifier": identifier,
            "texture_width": TEXTURE_WIDTH,
            "texture_height": TEXTURE_HEIGHT,
            "visible_bounds_width": VISIBLE_BOUNDS_WIDTH,
            "visible_bounds_height": VISIBLE_BOUNDS_HEIGHT,
            "visible_bounds_offset": VISIBLE_BOUNDS_OFFSET
        },
        "bones": []
    }
    
    bone = {"name": "fluid", "pivot": [0, 0, 0], "cubes": []}
    
    # Use the fraction for calculations
    if slope == "none" or fluid_height < 4 or (1 - depth_fraction) < 0.01:
        cube = {
            "origin": [0, 0, 0],
            "size": [16, fluid_height, 16],
            "uv": [0, 0]
        }
        bone["cubes"].append(cube)
        model["bones"].append(bone)
        return model

    drop = round((1 - depth_fraction) * 4)
    
    slices = 8
    if slope in ["n", "s"]:
        slice_depth = 16 // slices
        for i in range(slices):
            z_origin = i * slice_depth
            center_z = z_origin + slice_depth / 2
            factor = center_z / 16 if slope == "n" else 1 - (center_z / 16)
            slice_top = (fluid_height - drop) + factor * drop
            slice_height = max(1, round(slice_top))
            cube = {
                "origin": [0, 0, z_origin],
                "size": [16, slice_height, slice_depth],
                "uv": [0, 0]
            }
            bone["cubes"].append(cube)
    elif slope in ["e", "w"]:
        slice_width = 16 // slices
        for i in range(slices):
            x_origin = i * slice_width
            center_x = x_origin + slice_width / 2
            factor = center_x / 16 if slope == "w" else 1 - (center_x / 16)
            slice_top = (fluid_height - drop) + factor * drop
            slice_height = max(1, round(slice_top))
            cube = {
                "origin": [x_origin, 0, 0],
                "size": [slice_width, slice_height, 16],
                "uv": [0, 0]
            }
            bone["cubes"].append(cube)
    elif slope in ["ne", "nw", "se", "sw"]:
        diag_slices = 4
        slice_size = 16 // diag_slices
        for i in range(diag_slices):
            for j in range(diag_slices):
                x_origin = i * slice_size
                z_origin = j * slice_size
                center_x = x_origin + slice_size / 2
                center_z = z_origin + slice_size / 2

                if slope == "ne":
                    factor_x = 1 - (center_x / 16)
                    factor_z = center_z / 16
                elif slope == "nw":
                    factor_x = center_x / 16
                    factor_z = center_z / 16
                elif slope == "se":
                    factor_x = 1 - (center_x / 16)
                    factor_z = 1 - (center_z / 16)
                elif slope == "sw":
                    factor_x = center_x / 16
                    factor_z = 1 - (center_z / 16)
                
                factor = (factor_x + factor_z) / 2
                slice_top = (fluid_height - drop) + factor * drop
                slice_height = max(1, round(slice_top))
                cube = {
                    "origin": [x_origin, 0, z_origin],
                    "size": [slice_size, slice_height, slice_size],
                    "uv": [0, 0]
                }
                bone["cubes"].append(cube)
    
    model["bones"].append(bone)
    return model

def generate_geometries():
    """Generates and writes the fluid_geometry.json file."""
    print("Generating fluid geometries...")
    geometry_models = []
    # Iterate from 1 to MAX_DEPTH (e.g., 1 to 8)
    for depth_level in range(1, MAX_DEPTH + 1):
        for slope in SLOPE_VALUES:
            geometry_models.append(generate_model(depth_level, slope))

    output = {
        "format_version": GEOMETRY_FORMAT_VERSION,
        "minecraft:geometry": geometry_models
    }

    with open(GEOMETRY_OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Generated {len(geometry_models)} geometry models in '{GEOMETRY_OUTPUT_FILE}'.")


# --- Permutation Generation Logic (from perm_generator_sen.py) ---

def fluid_state_from_level(depth_level):
    """Converts an integer depth level (1-8) to a fluid state string."""
    # This now mirrors the JS logic where depth is an integer
    depth_fraction = depth_level / float(MAX_DEPTH)
    thresholds = [
        (0.875, "full"),
        (0.75,  "flowing_0"),
        (0.625, "flowing_1"),
        (0.5,   "flowing_2"),
        (0.375, "flowing_3"),
        (0.25,  "flowing_4"),
        (0.125, "flowing_5"),
    ]
    for thresh, state in thresholds:
        if depth_fraction >= thresh:
            return state
    return "empty" # Should not be reached if depth_level >= 1

def generate_permutations():
    """Generates and writes the fluid_block_permutations.json file."""
    print("\nGenerating fluid block permutations...")
    permutations = []
    for depth_level in range(1, MAX_DEPTH + 1):
        state_name = fluid_state_from_level(depth_level)
        for slope in SLOPE_VALUES:
            # Use the integer depth level for the identifier to match geometry
            geom_id = f"geometry.lumstudio.fluid.{depth_level}_{slope}"
            # The condition in-game will check the integer 'lumstudio:depth' state
            condition = f"q.block_state('lumstudio:depth') == {depth_level -1} && q.block_state('slope') == '{slope}'"
            entry = {
                "condition": condition,
                "components": {
                    "minecraft:geometry": geom_id,
                    # Also set the fluid_state string for compatibility
                    "minecraft:block_state": {
                        "fluid_state": state_name
                    }
                }
            }
            permutations.append(entry)

    output = {
        "format_version": PERMUTATIONS_FORMAT_VERSION,
        "minecraft:client_block_permutations": permutations
    }

    with open(PERMUTATIONS_OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Generated {len(permutations)} permutation entries in '{PERMUTATIONS_OUTPUT_FILE}'.")


# --- Main Execution ---

if __name__ == "__main__":
    generate_geometries()
    generate_permutations()
    print("\nFluid asset generation complete.")