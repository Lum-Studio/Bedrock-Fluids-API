# Bedrock Fluids API

This document outlines the architecture and components of the Bedrock Fluids API, a system designed to simulate custom fluid dynamics in Minecraft Bedrock Edition by leveraging its existing scripting and resource pack capabilities.

## How to Use and Extend (Manual Process)

To create a new custom fluid, you must currently perform these steps manually:

1.  **Create Assets**: Create texture files for your fluid and its bucket.
2.  **Update Resource Pack**:
    -   Add texture definitions to `terrain_texture.json` and `item_texture.json`.
    -   Add a block definition to `blocks.json` mapping your fluid block to its textures.
3.  **Update Behavior Pack**:
    -   Create a new block definition file (e.g., `my_new_fluid.json`) in the `blocks` folder.
    -   Create a bucket item definition file in the `items` folder. Remember to give it a `placer:<your_fluid_id>` tag.
    -   In `API.js`, import `FluidQueue` and add a new instance for your fluid to the `Queues` object.
4.  **Run the Game**: The system will now recognize and update your new fluid.