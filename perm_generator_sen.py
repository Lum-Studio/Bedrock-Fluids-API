import json

# Configuration
OUTPUT_FILE = "fluid_block_permutations.json"
FORMAT_VERSION = "1.16.100"  # Client permutation JSON format version
DEPTH_VALUES = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0]

def fluid_state(depth):
    if depth >= 0.875:
        return "full"
    elif depth >= 0.75:
        return "flowing_0"
    elif depth >= 0.625:
        return "flowing_1"
    elif depth >= 0.5:
        return "flowing_2"
    elif depth >= 0.375:
        return "flowing_3"
    elif depth >= 0.25:
        return "flowing_4"
    elif depth >= 0.125:
        return "flowing_5"
    else:
        return "empty"

# Possible slope values
SLOPE_VALUES = ["none", "n", "e", "s", "w"]

permutations = []
for depth in DEPTH_VALUES:
    base_state = fluid_state(depth)
    percent = int(depth * 100)
    for slope in SLOPE_VALUES:
        # Geometry identifiers follow the pattern:
        # geometry.custom.fluid.oil.<percent>_<slope>
        geom_id = f"geometry.custom.fluid.oil.{percent}_{slope}"
        condition = f"q.block_state('fluid_state') == '{base_state}' && q.block_state('slope') == '{slope}'"
        entry = {
            "condition": condition,
            "components": {
                "minecraft:geometry": geom_id
            }
        }
        permutations.append(entry)

output = {
    "format_version": FORMAT_VERSION,
    "minecraft:client_block_permutations": permutations
}

with open(OUTPUT_FILE, "w") as f:
    json.dump(output, f, indent=2)

print(f"Generated {len(permutations)} permutation entries in '{OUTPUT_FILE}'.")
