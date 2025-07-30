# Minecraft Bedrock: Fog Settings in Resource Packs

Fogs in Minecraft: Bedrock Edition are configurable using JSON files. These settings allow creators to define custom visual atmospheres for different environments, such as air, water, lava, and more.

---

## 1. Fog File Structure

Fog settings are placed in a `fogs/` folder at the root of your Resource Pack. Each JSON file defines one fog preset and must follow the correct format.

### Example:

```json
{
  "format_version": "1.16.100",
  "minecraft:fog_settings": {
    "description": {
      "identifier": "custom_pack:example"
    },
    "distance": {
      "air": {
        "fog_start": 0.92,
        "fog_end": 1.0,
        "fog_color": "#ABD2FF",
        "render_distance_type": "render"
      },
      "water": {
        "fog_start": 0,
        "fog_end": 60.0,
        "fog_color": "#44AFF5",
        "render_distance_type": "fixed",
        "transition_fog": {
          "init_fog": {
            "fog_start": 0.0,
            "fog_end": 0.01,
            "fog_color": "#44AFF5",
            "render_distance_type": "fixed"
          },
          "min_percent": 0.25,
          "mid_seconds": 5,
          "mid_percent": 0.6,
          "max_seconds": 30
        }
      },
      "weather": {
        "fog_start": 0.23,
        "fog_end": 0.7,
        "fog_color": "#666666",
        "render_distance_type": "render"
      }
    }
  }
}
```

---

## 2. Fog Distance Types

Distance-based fog affects visibility and is categorized by environment:

- **air** – when the camera is in open air.
- **water** – when submerged.
- **weather** – during rain or snow.
- **lava** – in lava.
- **lava\_resistance** – in lava with the Lava Resistance effect.

Each setting supports:

- `fog_start`, `fog_end`: Distance range of fog effect.
- `fog_color`: Hex color string.
- `render_distance_type`: `render` (relative to player's render distance) or `fixed` (absolute block count).

### Optional: `transition_fog`

Smooths transition into fog underwater.

---

## 3. Volumetric Fog

### Available only for Ray Tracing and format version `1.16.100+`

Defined under the `volumetric` object:

- **density**: Controls light disruption and altitude behavior.
  - `uniform`: Applies equally at all heights.
  - `zero_density_height`, `max_density_height`: Required if `uniform` is false.
- **media\_coefficients**:
  - `scattering`: Color spread of light.
  - `absorption`: Color absorption.
- **henyey\_greenstein\_g**: (1.21.90+) Controls light scatter distribution.

---

## 4. Assigning Fog to Biomes

In `biomes_client.json`, set fog per biome:

```json
{
  "biomes": {
    "ice_plains": {
      "fog_identifier": "minecraft:fog_ice_plains"
    },
    "default": {
      "fog_identifier": "minecraft:fog_default"
    }
  }
}
```

---

## 5. Fog Priority: Active Fog Stack

Minecraft uses a stack to determine which fog to apply:

**Priority Order (Top to Bottom):**

1. `/fog` command
2. Biome-defined fog
3. Data-default (fallback biome fog)
4. Engine default (hardcoded)

If a higher layer lacks a setting, the engine checks the next layer.

---

## 6. Using the /fog Command

Manipulate fog stack via command layer:

- `/fog push <target> ID <identifier>` – Add to top
- `/fog pop <target> ID <identifier>` – Remove most recent match
- `/fog remove <target> ID <identifier>` – Remove all matches

Fog states are saved and restored per-player between sessions.

---

With fog settings, creators can create immersive environments ranging from misty swamps to thick underwater haze or even volcanic heat shimmer. Combine biome identifiers, transition effects, and volumetric settings for cinematic results.

