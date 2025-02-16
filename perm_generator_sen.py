import json

# Configuration
OUTPUT_FILE = "fluid_block_permutations.json"
FORMAT_VERSION = "1.16.100"  # Permutation JSON format version
DEPTH_VALUES = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0]

def fluid_state(depth):
    thresholds = [
        (0.875, "full"),
        (0.75,  "flowing_0"),
        (0.625, "flowing_1"),
        (0.5,   "flowing_2"),
        (0.375, "flowing_3"),
        (0.25,  "flowing_4"),
        (0.125, "flowing_5"),
        (0,     "empty")
    ]
    for thresh, state in thresholds:
        if depth >= thresh:
            return state

# Possible slope values.
SLOPE_VALUES = ["none", "n", "e", "s", "w"]

permutations = []
for depth in DEPTH_VALUES:
    base_state = fluid_state(depth)
    percent = int(depth * 100)
    for slope in SLOPE_VALUES:
        # Geometry identifier pattern: geometry.custom.fluid.oil.<percent>_<slope>
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
