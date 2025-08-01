# Minecraft Block Components Reference

## Applying Components

Block components can be applied directly in the `components` child of `minecraft:block`, or per block permutation.

### Example

**File:** `BP/blocks/lamp.json`

```json
{
  "format_version": "1.21.90",
  "minecraft:block": {
    "description": {
      "identifier": "wiki:lamp",
      "menu_category": {
        "category": "items"
      }
    },
    "components": {
      "minecraft:light_dampening": 0,
      "minecraft:light_emission": 15,
      "minecraft:map_color": [210, 200, 190],
      "minecraft:geometry": {
        "identifier": "geometry.lamp",
        "culling": "wiki:culling.lamp"
      },
      "minecraft:material_instances": {
        "*": {
          "texture": "wiki:lamp"
        },
        "shade": {
          "texture": "wiki:lamp_shade"
        }
      }
    }
  }
}
```

---

## Vanilla Components

### Collision Box

Defines the collision area.

- Boolean: `true` (default) enables full 16×16×16 collision.
- Object:

```json
"minecraft:collision_box": {
  "origin": [-8, 0, -8],
  "size": [16, 16, 16]
}
```

### Crafting Table

Enables block as crafting interface.

```json
"minecraft:crafting_table": {
  "table_name": "Wiki Workbench",
  "crafting_tags": ["crafting_table", "wiki:workbench"]
}
```

### Destructible by Explosion

- Boolean:

```json
"minecraft:destructible_by_explosion": false
```

- Object:

```json
"minecraft:destructible_by_explosion": {
  "explosion_resistance": 20
}
```

### Destructible by Mining

- Boolean:

```json
"minecraft:destructible_by_mining": false
```

- Object:

```json
"minecraft:destructible_by_mining": {
  "seconds_to_destroy": 20
}
```

### Destruction Particles

```json
"minecraft:destruction_particles": {
  "texture": "wiki:particle_texture",
  "tint_method": "grass"
}
```

### Display Name

```json
"minecraft:display_name": "tile.wiki:custom_block.name"
```

Language File:

```
tile.wiki:custom_block.name=Custom Block
```

### Entity Fall On

```json
"minecraft:entity_fall_on": {
  "min_fall_distance": 5
}
```

### Flammable

- Boolean:

```json
"minecraft:flammable": true
```

- Object:

```json
"minecraft:flammable": {
  "catch_chance_modifier": 5,
  "destroy_chance_modifier": 20
}
```

### Friction

```json
"minecraft:friction": 0.4
```

### Geometry

- String:

```json
"minecraft:geometry": "geometry.example_block"
```

- Object:

```json
"minecraft:geometry": {
  "identifier": "geometry.example_block",
  "culling": "wiki:culling.example_block",
  "bone_visibility": {
    "wiki_bone": false,
    "conditional_bone": "q.block_state('wiki:example_state') == 3",
    "another_bone": true
  }
}
```

### Item Visual

```json
"minecraft:item_visual": {
  "geometry": "minecraft:geometry.full_block",
  "material_instances": {
    "*": {
      "texture": "wiki:block_texture"
    }
  }
}
```

### Light Dampening

```json
"minecraft:light_dampening": 15
```

### Light Emission

```json
"minecraft:light_emission": 10
```

### Liquid Detection

```json
"minecraft:liquid_detection": {
  "detection_rules": [
    {
      "liquid_type": "water",
      "can_contain_liquid": true,
      "on_liquid_touches": "no_reaction"
    }
  ]
}
```

### Loot

```json
"minecraft:loot": "loot_tables/blocks/custom_block.json"
```

### Map Color

- Array:

```json
"minecraft:map_color": [255, 255, 255]
```

- String:

```json
"minecraft:map_color": "#FFFFFF"
```

- Object:

```json
"minecraft:map_color": {
  "color": "#FFFFFF",
  "tint_method": "grass"
}
```

### Material Instances

```json
"minecraft:material_instances": {
  "*": {
    "texture": "wiki:texture_name",
    "render_method": "blend"
  },
  "end": {
    "texture": "wiki:texture_name_end",
    "render_method": "blend"
  },
  "up": "end",
  "down": "end",
  "flower": {
    "texture": "wiki:texture_name_flower",
    "render_method": "blend"
  }
}
```

### Placement Filter

```json
"minecraft:placement_filter": {
  "conditions": [
    {
      "allowed_faces": ["up"],
      "block_filter": [
        "minecraft:dirt",
        {
          "name": "minecraft:sand",
          "states": {
            "sand_type": "red"
          }
        },
        {
          "tags": "!q.any_tag('minecraft:crop', 'wiki:tag')"
        }
      ]
    }
  ]
}
```

### Redstone Conductivity

```json
"minecraft:redstone_conductivity": {
  "redstone_conductor": true,
  "allows_wire_to_step_down": false
}
```

### Replaceable

```json
"minecraft:replaceable": {}
```

### Selection Box

- Boolean:

```json
"minecraft:selection_box": true
```

- Object:

```json
"minecraft:selection_box": {
  "origin": [-8, 0, -8],
  "size": [16, 16, 16]
}
```

### Tick

```json
"minecraft:tick": {
  "interval_range": [10, 20],
  "looping": true
}
```

### Transformation

```json
"minecraft:transformation": {
  "translation": [-5, 8, 0],
  "rotation": [90, 180, 0],
  "rotation_pivot": [0, 0, 0],
  "scale": [0.5, 1, 0.5],
  "scale_pivot": [0, 0, 0]
}
```

