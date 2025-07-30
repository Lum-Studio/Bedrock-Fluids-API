# Minecraft Bedrock: Block Permutations Guide

Block permutations allow developers to create dynamic behavior in custom blocks based on the block's state configuration. This guide will walk you through what permutations are, how to use them, and important constraints.

---

## 1. What Are Block Permutations?

Block permutations represent every possible combination of state values that a block can take.

### Example:

If your custom block defines two boolean states:

```json
"states": {
  "wiki:first_state": [false, true],
  "wiki:second_state": [false, true]
}
```

Then the following four permutations exist:

| Block Identifier            | wiki\:first\_state | wiki\:second\_state |
| --------------------------- | ------------------ | ------------------- |
| wiki\:permutations\_example | false              | false               |
| wiki\:permutations\_example | true               | false               |
| wiki\:permutations\_example | false              | true                |
| wiki\:permutations\_example | true               | true                |

**Permutation count formula:** Multiply the number of valid values for each state. For example, 2 × 2 = 4 permutations.

---

## 2. Misconceptions

- All blocks have at least one permutation, even if no states are defined.
- The number of permutations is determined **by the states**, not the number of entries in the `permutations` array.

---

## 3. Conditionally Applying Components

Permutations let you apply components conditionally based on a block's state.

- Components in the `permutations` array override those in the base `components` object.
- Only one instance of a component can be active; later permutation entries override earlier ones.

### Example:

**File:** `BP/blocks/custom_block.json`

```json
{
  "format_version": "1.21.90",
  "minecraft:block": {
    "description": {
      "identifier": "wiki:custom_block",
      "states": {
        "wiki:integer_state_example": [2, 4, 6, 8],
        "wiki:boolean_state_example": [false, true],
        "wiki:string_state_example": ["red", "green", "blue"]
      }
    },
    "components": {},
    "permutations": [
      {
        "condition": "q.block_state('wiki:integer_state_example') == 2",
        "components": {
          "minecraft:friction": 0.1
        }
      },
      {
        "condition": "q.block_state('wiki:boolean_state_example')",
        "components": {
          "minecraft:friction": 0.8
        }
      },
      {
        "condition": "q.block_state('wiki:string_state_example') == 'red' && !q.block_state('wiki:boolean_state_example')",
        "components": {
          "minecraft:geometry": "geometry.pig"
        }
      }
    ]
  }
}
```

---

## 4. Permutation Conditions

Conditions are Molang expressions that determine if a permutation’s components are applied.

### Notes:

- Only `q.block_state()` can be used in these conditions.
- You **cannot** use randomness (e.g., `math.random`) or assign variables.
- Conditions must be **pure** and **deterministic**.

### Examples:

```molang
q.block_state('wiki:integer_state_example') < 6 || !q.block_state('wiki:boolean_state_example')
```

---

## 5. Limits

### Engine Requirements:

- Minimum format version: `1.19.70` (for `permutations`)
- Recommended minimum engine version in `manifest.json`: `1.20.20`
- Current supported: `1.21.90`

### Maximum Limits:

- **Maximum permutations per block:** 4096
- **Maximum total permutations per world:** 131072

If your total permutations exceed these limits, Minecraft may crash or exhibit undefined behavior.

---

Using permutations properly allows you to create highly dynamic and stateful blocks with different appearances, behaviors, and interactions—all without needing separate block identifiers.

