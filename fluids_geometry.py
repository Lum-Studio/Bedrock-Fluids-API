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
# Slope directions: "none" means flat (source-like), and "n", "e", "s", "w" are flowing states.
SLOPE_VALUES = ["none", "n", "e", "s", "w"]

def generate_model(depth, slope):
    """
    Generates a geometry model for a given fluid depth and slope state.
    
    To mimic Minecraft’s fluid surface (which is a smooth quad with per‐vertex heights)
    despite Bedrock’s JSON limitations, we use these workarounds:
    
    1. The fluid is anchored at the block bottom (y=0). The total fluid height in pixels is:
         fluid_height = round(depth * 16)
         
    2. For flowing fluids (slope != "none" and depth < 1) we want one edge to be “lower.”
       We compute a drop value that reaches 4 pixels at depth 0 and 0 at depth 1:
         drop = round((1 - depth) * 4)
       (This maximum drop of 4 is chosen to mimic Minecraft’s gentle slope.)
       
    3. To get a smooth (non‐staircase) slope, we subdivide the 16×16 block into 8 slices along
       the flow direction. For north/south slopes the subdivision is along the z‑axis; for east/west,
       along the x‑axis.
       
       For example, for a north slope the “north” edge (z = 0) will be at a reduced height
       (fluid_height – drop) while the “south” edge (z = 16) is at full height (fluid_height).
       Each slice’s top height is linearly interpolated between these values.
       
    4. For “none” or very shallow fluids (fluid_height < 4), we simply generate one flat cube.
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
    # Number of slices to subdivide along the flow axis.
    slices = 8

    # For north/south slopes, we subdivide along z.
    if slope in ["n", "s"]:
        slice_depth = 16 // slices  # Each slice covers this many pixels in z.
        # For a north slope, the north edge (z=0) is low; for a south slope, the south edge is low.
        # Define factor f for interpolation: for north, f = center_z / 16; for south, f = 1 - center_z/16.
        for i in range(slices):
            z_origin = i * slice_depth
            center_z = z_origin + slice_depth / 2
            if slope == "n":
                factor = center_z / 16  # f=0 at north (z=0), f=1 at south (z=16)
            else:  # slope == "s"
                factor = 1 - (center_z / 16)
            # Interpolated top height for this slice.
            slice_top = (fluid_height - drop) + factor * drop
            # Ensure at least 1 pixel high.
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
            if slope == "w":
                factor = center_x / 16  # f=0 at west (x=0), f=1 at east (x=16)
            else:  # slope == "e"
                factor = 1 - (center_x / 16)
            slice_top = (fluid_height - drop) + factor * drop
            slice_height = max(1, round(slice_top))
            cube = {
                "origin": [x_origin, 0, 0],
                "size": [slice_width, slice_height, 16],
                "uv": [0, 0]
            }
            bone["cubes"].append(cube)
    
    model["bones"].append(bone)
    return model

# Generate all models (40 in total: 8 depths × 5 slopes)
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
