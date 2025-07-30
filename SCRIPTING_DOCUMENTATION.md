# Bedrock Fluids API - Scripting Documentation

This document outlines the architecture and usage of the in-game scripting system for the Bedrock Fluids API. The system is designed to be modular, extensible, and easy to maintain.

## System Architecture

The scripting system is built on a modular architecture with a centralized registry. This means that core functionalities are separated into their own files, and adding new fluids or effects can be done with minimal changes to the core logic.

The main principles are:
1.  **Registry-Driven:** All fluid definitions are stored in a single `registry.js` file. The rest of the system reads from this registry to determine how to behave.
2.  **Modular Effects:** Each player effect (like taking damage, being set on fire, or receiving a status effect) is its own self-contained module.
3.  **Centralized Logic:** The core fluid physics (flowing, drying up) and player interaction logic are centralized in `fluids.js`.
4.  **Optimized Performance:** The system uses a queue (`queue.js`) to process block updates over time, preventing lag spikes that would occur from updating many fluid blocks in a single game tick.
5.  **Global Event System:** A custom event handler (`BlockUpdate.js`) provides a single, reliable "block updated" event, which is crucial for the fluid simulation.

---

## File Structure

All scripts are located in the `refactored_scripts/` directory.

```
refactored_scripts/
├── main.js               # Main entry point for the addon
├── registry.js           # <-- ADD NEW FLUIDS HERE
├── fluids.js             # Core fluid simulation and player interaction logic
├── BlockUpdate.js        # Custom block update event handler
├── queue.js              # Performance optimization queue
└── effects/
    ├── index.js          # Central effects handler
    ├── damage.js         # Module for applying damage
    ├── burn.js           # Module for applying fire
    └── statusEffect.js   # Module for applying status effects
```

### Key Files Description

*   **`main.js`**: The entry point. Its only job is to import and run `fluids.js`.
*   **`registry.js`**: This is where you define all your custom fluids. To add a new fluid, you simply add a new entry to the `FluidRegistry` object.
*   **`fluids.js`**: Contains the core logic. It reads the `FluidRegistry`, initializes the update queues, and handles the main game loop for player interactions (buoyancy, fog, and calling the effects system).
*   **`effects/index.js`**: This file maps fluid properties from the registry (e.g., `damage`) to the actual script modules that apply the effects.

---

## How to Add a New Fluid

Adding a new fluid is simple and requires editing only **one file**: `registry.js`.

1.  Open `refactored_scripts/registry.js`.
2.  Add a new entry to the `FluidRegistry` object. The key must be the custom identifier of your fluid block (e.g., `lumstudio:crude_oil`).

**Example: Adding Crude Oil**

```javascript
// refactored_scripts/registry.js

export const FluidRegistry = {
  // ... existing fluids
  "lumstudio:crude_oil": {
    damage: 0,          // Damage per tick
    burnTime: 0,        // Seconds to burn for
    fog: "black",       // Fog color identifier
    buoyancy: 0.01,     // Upward force (positive) or downward (negative)
    effect: "slowness", // Any valid Minecraft status effect
    boat: true,         // Whether boats can float on it
  },
};
```

### Available Fluid Properties

*   `damage` (number): The amount of damage the fluid deals per tick to an entity inside it.
*   `burnTime` (number): The number of seconds an entity will be set on fire for.
*   `fog` (string): The identifier for the fog effect to apply to the player's camera.
*   `buoyancy` (number): A value that affects how entities float. Positive values push up, negative values pull down.
*   `effect` (string): The identifier of a Minecraft status effect (e.g., `poison`, `night_vision`, `weakness`).
*   `boat` (boolean): If `true`, boats will be able to float on this fluid.

---

## How to Add a New Effect

To add a completely new type of effect (e.g., one that repairs armor), you need to create a new module.

1.  **Create the Module:** Create a new file in the `refactored_scripts/effects/` directory (e.g., `repair.js`). The file must export an `apply` function.

    **Example: `repair.js`**
    ```javascript
    // refactored_scripts/effects/repair.js
    export function apply(entity, fluidData) {
        // Check if the fluid is configured to repair and if the entity has the component
        if (fluidData.repairAmount > 0 && entity.hasComponent("minecraft:equippable")) {
            const equipment = entity.getComponent("minecraft:equippable");
            const item = equipment.getEquipment("Mainhand");
            if (item && item.hasComponent("minecraft:durability")) {
                const durability = item.getComponent("minecraft:durability");
                durability.damage -= fluidData.repairAmount; // Decrease damage (repair)
            }
        }
    }
    ```

2.  **Register the Module:** Open `refactored_scripts/effects/index.js` and add your new module to the `effectHandlers` map. The key should be the property you'll use in the registry.

    **Example: `effects/index.js`**
    ```javascript
    // ... imports
    import { apply as applyRepair } from "./repair.js";

    export const effectHandlers = {
        damage: applyDamage,
        burnTime: applyBurn,
        effect: applyStatusEffect,
        repairAmount: applyRepair, // <-- Add the new handler
    };
    ```

3.  **Use in Registry:** You can now use the `repairAmount` property when defining a fluid in `registry.js`.

This modular system ensures that the core logic remains untouched and new features can be added safely and cleanly.
