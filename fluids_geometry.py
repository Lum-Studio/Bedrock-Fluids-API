import json 
import math

# Configuration
OUTPUT_FILE = "fluid_geometry.json"
FORMAT_VERSION = "1.12.0"
TEXTURE_WIDTH = 64
TEXTURE_HEIGHT = 64
VISIBLE_BOUNDS_WIDTH = 16
VISIBLE_BOUNDS_HEIGHT = 16
VISIBLE_BOUNDS_OFFSET = [0, 0, 0]

# Fluid depths (as fraction of full block, where 1.0 is a source block)
DEPTH_VALUES = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0]
# Slope directions: "none" means flat (source‐like), "n", "e", "s", "w" for cardinal flows,
# and the diagonal flows "ne", "nw", "se", "sw".
SLOPE_VALUES = ["none", "n", "e", "s", "w", "ne", "nw", "se", "sw"]

def generate_model(depth, slope):
    """
    Generates a geometry model for a given fluid depth and slope state.
    
    To mimic Minecraft’s fluid surface (a smooth quad with per‐vertex heights)
    despite Bedrock’s JSON limitations, we use these workarounds:
    
    1. The fluid is anchored at the block bottom (y=0). The total fluid height in pixels is:
         fluid_height = round(depth * 16)
         
    2. For flowing fluids (slope != "none" and depth < 1) we want one edge to be “lower.”
       We compute a drop value that reaches 4 pixels at depth 0 and 0 at depth 1:
         drop = round((1 - depth) * 4)
       
    3. For cardinal slopes (n, e, s, w) we subdivide the 16×16 block into 8 slices along the flow axis.
    
    4. For diagonal slopes (ne, nw, se, sw) we subdivide along both the x and z axes (using 4 slices each),
       and compute the top height via bilinear interpolation so that the two corresponding edges are lower.
       
    5. For “none” or very shallow fluids (fluid_height < 4), we simply generate one flat cube.
    """
    # Total fluid height in pixels (0 <= y < 16)
    fluid_height = round(depth * 16)
    percent = int(depth * 100)
    identifier = f"geometry.custom.fluid.oil.{percent}_{slope}"
    
    # Build the base model description.
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
    
    # If fluid is flat or too shallow to subdivide, output a single cube.
    if slope == "none" or fluid_height < 4 or (1 - depth) < 0.01:
        cube = {
            "origin": [0, 0, 0],
            "size": [16, fluid_height, 16],
            "uv": [0, 0]
        }
        bone["cubes"].append(cube)
        model["bones"].append(bone)
        return model

    # Compute the drop in pixels (max 4 at depth=0, 0 at depth=1)
    drop = round((1 - depth) * 4)
    
    # For cardinal slopes: subdivide along one axis.
    slices = 8
    if slope in ["n", "s"]:
        slice_depth = 16 // slices  # Each slice covers this many pixels in z.
        for i in range(slices):
            z_origin = i * slice_depth
            center_z = z_origin + slice_depth / 2
            # For north, lower edge at z=0; for south, lower edge at z=16.
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
        slice_width = 16 // slices  # Each slice covers this many pixels in x.
        for i in range(slices):
            x_origin = i * slice_width
            center_x = x_origin + slice_width / 2
            # For west, lower edge at x=0; for east, lower edge at x=16.
            factor = center_x / 16 if slope == "w" else 1 - (center_x / 16)
            slice_top = (fluid_height - drop) + factor * drop
            slice_height = max(1, round(slice_top))
            cube = {
                "origin": [x_origin, 0, 0],
                "size": [slice_width, slice_height, 16],
                "uv": [0, 0]
            }
            bone["cubes"].append(cube)
    # For diagonal slopes: subdivide along both x and z.
    elif slope in ["ne", "nw", "se", "sw"]:
        diag_slices = 4  # Number of subdivisions in both x and z directions.
        slice_size = 16 // diag_slices  # Cube size in x and z.
        for i in range(diag_slices):
            for j in range(diag_slices):
                x_origin = i * slice_size
                z_origin = j * slice_size
                center_x = x_origin + slice_size / 2
                center_z = z_origin + slice_size / 2

                # Compute factors for x and z directions based on the diagonal type.
                if slope == "ne":
                    # Lower at north (z=0) and east (x=16).
                    factor_x = 1 - (center_x / 16)
                    factor_z = center_z / 16
                elif slope == "nw":
                    # Lower at north (z=0) and west (x=0).
                    factor_x = center_x / 16
                    factor_z = center_z / 16
                elif slope == "se":
                    # Lower at south (z=16) and east (x=16).
                    factor_x = 1 - (center_x / 16)
                    factor_z = 1 - (center_z / 16)
                elif slope == "sw":
                    # Lower at south (z=16) and west (x=0).
                    factor_x = center_x / 16
                    factor_z = 1 - (center_z / 16)
                # Average the factors to get a bilinear interpolation effect.
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

# Generate all models (72 in total: 8 depths × 9 slopes)
geometry_models = []
for depth in DEPTH_VALUES:
    for slope in SLOPE_VALUES:
        geometry_models.append(generate_model(depth, slope))

output = {
    "format_version": FORMAT_VERSION,
    "minecraft:geometry": geometry_models
}

with open(OUTPUT_FILE, "w") as f:
    json.dump(output, f, indent=2)

print(f"Generated {len(geometry_models)} geometry models in '{OUTPUT_FILE}'.")
