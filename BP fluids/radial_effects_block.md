# Minecraft Bedrock: Applying Radial Status Effects from Blocks

This tutorial explains how to create a custom block in Minecraft Bedrock Edition that applies status effects to nearby entities within a specific radius, similar to how a vanilla Beacon works.

---

## 1. Block Tick Component

To trigger periodic updates (like a beacon pulse), we use the `minecraft:tick` component.

### Example:

```json
"minecraft:tick": {
  "interval_range": [80, 80],
  "looping": true
}
```

- **interval\_range**: Executes every 80 ticks (4 seconds). Using the same value for min and max ensures no randomness.
- **looping**: Enables repeated ticking.

---

## 2. Custom Component Registration

To apply effects on tick, we use a custom component. Define it under the `components` section of your block JSON.

### Block JSON Example:

```json
"wiki:radial_effects": [
  {
    "radius": 64,
    "name": "wither",
    "duration": 600,
    "amplifier": 1
  },
  {
    "radius": 64,
    "name": "slowness",
    "duration": 600,
    "amplifier": 2
  }
]
```

- **radius**: Affects entities within this range of the block.
- **name**: The status effect to apply.
- **duration**: Time in ticks (600 = 30 seconds).
- **amplifier**: Effect strength.

---

## 3. Scripting the Custom Component

In your behavior pack scripts directory, create a script to define and register the custom component.

### File: `BP/scripts/radialEffects.js`

```js
import { system } from "@minecraft/server";

/** @type {import("@minecraft/server").BlockCustomComponent} */
const BlockRadialEffectsComponent = {
  onTick({ block, dimension }, { params }) {
    const effects = params; // The array from the block JSON

    for (const { radius, name, duration, amplifier } of effects) {
      const entities = dimension.getEntities({
        location: block.center(),
        maxDistance: radius
      });

      for (const entity of entities) {
        entity.addEffect(name, duration, { amplifier });
      }
    }
  }
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent(
    "wiki:radial_effects",
    BlockRadialEffectsComponent
  );
});
```

### Explanation:

- The `onTick` function runs every time the block ticks.
- It uses `dimension.getEntities()` to find nearby entities.
- Each entity is given the specified effects.

---

With this setup, your custom block can emit a persistent area-of-effect similar to a beacon, but with custom behaviors and parameters. This opens up many possibilities for gameplay mechanics like traps, buffs, environmental hazards, or healing zones.

