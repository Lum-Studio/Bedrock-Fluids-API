# Bedrock Fluids API

A proof-of-concept system for simulating custom fluids in Minecraft Bedrock Edition. This project provides a framework for creating realistic fluid dynamics by leveraging resource packs, behavior packs with custom scripting, and Python-based asset generation.

## Current Status

This project is a functional proof-of-concept but is **incomplete**. The core fluid simulation logic is working, but the automated compiler for adding new fluids is not fully implemented. Adding new fluids currently requires manual changes to several files.

## How It Works

The system is built on three main pillars:

1.  **State-Driven Geometry**: The visual appearance of the fluid is determined by block states, primarily `lumstudio:depth` (representing depth) and `slope` (representing flow direction). Each combination of these states corresponds to a unique block permutation with a specific 3D model.

2.  **Asset Generation**: Python scripts (`generate_fluid_assets.py`) are used to pre-generate the complex JSON files that define the fluid's geometry and block state permutations.

3.  **Scripting Core**: A set of JavaScript files running in the behavior pack manages the fluid's logic.
    -   A custom `onNeighborChanged` event is simulated by the `BlockUpdate.js` script, which hooks into dozens of game events (like block placement, explosions, piston movement) and even overrides native `Block` methods to detect changes.
    -   `API.js` contains the core fluid dynamics logic, calculating how fluids should fall, spread, and dry up.
    -   `queue.js` manages a block update queue to process fluid changes tick-by-tick without overwhelming the game engine.
    -   `fluids.js` handles direct player interaction, such as using buckets and applying effects like fog and buoyancy.

## How to Use (Current Manual Process)

1.  **Generate Assets**: Use `generate_fluid_assets.py` to create the `fluid_geometry.json` and `fluid_block_permutations.json`.
2.  **Create Fluid Definition**: Manually create the block JSON file in `BP fluids/blocks/` and add its textures and models to the resource pack (`RP fluids`).
3.  **Register the Fluid**: In `BP fluids/scripts/API.js`, add your new fluid to the `Queues` object to register it with the update system.
4.  **Implement Bucket**: Add logic to `fluids.js` to handle the placement and pickup of your new fluid with its corresponding bucket item.

For the planned automated workflow, see `COMPILER_DESIGN.md`.