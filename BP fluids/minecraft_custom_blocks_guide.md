# Minecraft Bedrock Custom Blocks Guide

Minecraft Bedrock Edition allows the creation of custom blocks with a variety of vanilla-like properties. These blocks can have multiple stages (e.g., like plants), directional facing, and other functional components. This guide explains how to create a basic custom block compatible with stable versions of Minecraft.

---

## 1. Registering Custom Blocks

Block definitions reside in the behavior pack (BP) and are structured similarly to entities. They consist of a `description` section and a set of `components` that define their behavior. Unlike entities, blocks do not have separate resource definitions except for those declared in `RP/blocks.json`.

### Basic Block Definition Example:

**File:** `BP/blocks/custom_block.json`

```json
{
  "format_version": "1.21.90",
  "minecraft:block": {
    "description": {
      "identifier": "wiki:custom_block",
      "menu_category": {
        "category": "construction",
        "group": "minecraft:itemGroup.name.concrete",
        "is_hidden_in_commands": false
      }
    },
    "components": {}
  }
}
```

### Description Parameters:

- `identifier`: Unique block ID in the form `namespace:identifier`
- `menu_category`: Specifies the creative inventory category
  - `category`: Main tab (e.g., "construction")
  - `group`: Optional; defines an expandable group
  - `is_hidden_in_commands`: Optional; hides the block from command usage

## 2. Adding Components

Custom components give blocks functionality beyond the defaults. Here’s an enhanced version of the custom block:

**File:** `BP/blocks/custom_block.json`

```json
{
  "format_version": "1.21.90",
  "minecraft:block": {
    "description": {
      "identifier": "wiki:custom_block",
      "menu_category": {
        "category": "construction"
      }
    },
    "components": {
      "minecraft:destructible_by_mining": {
        "seconds_to_destroy": 3
      },
      "minecraft:destructible_by_explosion": {
        "explosion_resistance": 3
      },
      "minecraft:friction": 0.4,
      "minecraft:map_color": "#ffffff",
      "minecraft:light_dampening": 0,
      "minecraft:light_emission": 4,
      "minecraft:loot": "loot_tables/blocks/custom_block.json"
    }
  }
}
```

### Key Components:

- `minecraft:destructible_by_mining`: Time required to mine the block
- `minecraft:destructible_by_explosion`: Explosion resistance value
- `minecraft:friction`: Friction value (e.g., ice = low, soul sand = high)
- `minecraft:map_color`: Hex color on the map
- `minecraft:light_dampening`: How much light is blocked
- `minecraft:light_emission`: Light level emitted
- `minecraft:loot`: Loot table path

Browse all available components [here](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/).

---

## 3. Applying Textures

Textures are defined using `minecraft:geometry` and `minecraft:material_instances` components.

### Example (Single Texture):

```json
"minecraft:geometry": "minecraft:geometry.full_block",
"minecraft:material_instances": {
  "*": {
    "texture": "wiki:custom_block"
  }
}
```

### Texture Mapping:

**File:** `RP/textures/terrain_texture.json`

```json
{
  "resource_pack_name": "wiki",
  "texture_name": "atlas.terrain",
  "texture_data": {
    "wiki:custom_block": {
      "textures": "textures/blocks/custom_block"
    }
  }
}
```

---

## 4. Per-Face Textures

You can define unique textures for each face of the block.

### Material Instances Example:

```json
"minecraft:material_instances": {
  "down":   { "texture": "wiki:compass_block_down" },
  "up":     { "texture": "wiki:compass_block_up" },
  "north":  { "texture": "wiki:compass_block_north" },
  "east":   { "texture": "wiki:compass_block_east" },
  "south":  { "texture": "wiki:compass_block_south" },
  "west":   { "texture": "wiki:compass_block_west" }
}
```

### Texture Mapping:

**File:** `RP/textures/terrain_texture.json`

```json
{
  "resource_pack_name": "wiki",
  "texture_name": "atlas.terrain",
  "texture_data": {
    "wiki:compass_block_down": { "textures": "textures/blocks/compass_block_down" },
    "wiki:compass_block_up": { "textures": "textures/blocks/compass_block_up" },
    "wiki:compass_block_north": { "textures": "textures/blocks/compass_block_north" },
    "wiki:compass_block_east": { "textures": "textures/blocks/compass_block_east" },
    "wiki:compass_block_south": { "textures": "textures/blocks/compass_block_south" },
    "wiki:compass_block_west": { "textures": "textures/blocks/compass_block_west" }
  }
}
```

---

## 5. Applying Sounds

Block sounds such as breaking, placing, stepping, and mining are set via `RP/blocks.json`.

### Example:

**File:** `RP/blocks.json`

```json
{
  "format_version": "1.21.40",
  "wiki:custom_block": {
    "sound": "grass"
  }
}
```

Learn more about sound types [here](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/#sound).

---

## 6. Defining Names

Block display names are declared in a language file.

### Example:

**File:** `RP/texts/en_US.lang`

```
tile.wiki:custom_block.name=Custom Block
tile.wiki:compass_block.name=Compass Block
```

---

You’ve now created a fully functional custom block in Minecraft Bedrock Edition with texture, sound, loot, and more!

