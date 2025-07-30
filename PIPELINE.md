# Bedrock Fluids API: Generation Pipeline

This document outlines the end-to-end pipeline for the client-side fluid generator. The entire process is self-contained within the `index.html` file and runs exclusively in the user's web browser, requiring no backend server.

---

## Step 1: User Configuration (`index.html`)

The process begins with the user providing all the necessary configuration through the HTML form:

1.  **Fluid Properties:** The user inputs the fluid's name (e.g., "Liquid Honey"), a unique namespaced ID (e.g., `wiki:honey`), and functional properties like the fog color and buoyancy.
2.  **Texture Uploads:** The user uploads two `.png` image files:
    *   The texture for the fluid block itself.
    *   The texture for the fluid's bucket item.
3.  **Initiation:** The user clicks the "Generate Fluid Pack" button, which triggers the main JavaScript application logic embedded in the `index.html` file.

---

## Step 2: In-Memory Asset Generation (`generator.js`)

Once initiated, the application calls a series of functions from the `generator.js` script to create the core components of the addon in memory.

1.  **`generateGeometries()`:** This function programmatically builds the contents of `fluid_geometry.json`. It generates hundreds of unique 3D cube models that correspond to every possible fluid depth (1-8) and slope direction. This is the foundation of the fluid's visual appearance.

2.  **`generatePermutations()`:** This function creates the large array of block permutations. Each permutation is a Molang query that maps a specific combination of block states (e.g., `depth == 7` and `slope == 'n'`) to the corresponding 3D model generated in the previous step.

3.  **`getBlockJson()`:** This function assembles the final `minecraft:block` definition. It combines the user's configuration (ID, fog color) with the generated permutations to create the complete JSON file for the fluid block.

4.  **`getBucketItemJson()`:** This function creates the definition for the fluid's bucket. It uses the modern `minecraft:block_placer` component to handle the placement of the fluid block, including its initial "source block" states.

5.  **`getRegistrationScript()`:** This function generates the dynamic `register_fluids.js` script. This critical file makes the in-game scripting engine aware of the new fluid by creating and exporting a `FluidQueue` for it, ensuring its behavior is updated in-game.

6.  **`getManifestJson()`:** This function is called twice to generate the `manifest.json` files for both the behavior and resource packs, complete with unique UUIDs.

---

## Step 3: Pack Assembly (`JSZip`)

With all the file contents generated, the application uses the `JSZip` library to construct the addon's file structure within a zip archive in memory.

1.  **Directory Scaffolding:** It creates the standard addon folder structure (`BP/`, `RP/`, `BP/scripts/generated/`, `RP/models/blocks/`, etc.).

2.  **File Population:**
    *   The generated JSON files (manifests, block/item definitions, geometry, permutations) are placed in their correct locations.
    *   The user-uploaded textures are read from memory and added to the `RP/textures/` subfolders.
    *   The static in-game scripts (`API.js`, `fluids.js`, `queue.js`, `BlockUpdate.js`), which are embedded as strings within `index.html`, are parsed and added to the `BP/scripts/` folder.
    *   The dynamically generated `register_fluids.js` is placed in `BP/scripts/generated/`.
    *   Finally, the necessary texture mapping files (`blocks.json`, `item_texture.json`, `terrain_texture.json`) are created and added to the resource pack.

---

## Step 4: Download

The final step delivers the completed addon to the user:

1.  **Blob Creation:** The `JSZip` library generates the complete zip archive as a single binary blob.
2.  **Download Trigger:** The script creates a temporary, invisible `<a>` element, sets its `href` to the blob, and programmatically clicks it.
3.  **Final Product:** The browser initiates a download of the file, which is named with the `.mcaddon` extension. The user can then simply open this file to import the complete, ready-to-use fluid addon into Minecraft.