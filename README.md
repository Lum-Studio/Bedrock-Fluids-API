# Bedrock Custom Fluid Generator

A web-based tool for creating custom fluids in Minecraft Bedrock Edition. This project provides a user-friendly interface for generating complete, ready-to-use resource and behavior packs for custom fluids.

## Current Status

This project is fully functional. The generation of fluid packs is handled entirely in the browser, and the tool produces a `.mcaddon` file that can be directly imported into Minecraft.

## How It Works

The generator is a single HTML file (`index.html`) that uses JavaScript to generate all the necessary files for a custom fluid. The core logic is in `generator.js`.

1.  **User Interface**: The `index.html` file provides a form for the user to define their fluid's properties, such as its name, ID, textures, and in-game behavior.
2.  **Asset Generation**: The `generator.js` script contains all the logic for creating the fluid's 3D models, block permutations, and item definitions.
3.  **Pack Generation**: When the user clicks "Generate," the script creates all the necessary JSON files and textures in memory.
4.  **Zipping**: The generated files are then zipped into a `.mcaddon` file using the `JSZip` library.
5.  **Download**: The user is prompted to download the generated `.mcaddon` file, which can then be imported into Minecraft.

## How to Use

1.  **Open `index.html`**: Open the `index.html` file in a web browser.
2.  **Fill out the form**:
    *   **Fluid Name**: The name of your fluid (e.g., "Liquid Bismuth").
    *   **Block ID**: The fluid's unique identifier (e.g., `lumstudio:liquid_bismuth`).
    *   **Fluid Texture**: The texture for the fluid block.
    *   **Bucket Texture**: The texture for the fluid's bucket item.
    *   **Fog Color**: The color of the fog effect when inside the fluid.
    *   **Buoyancy**: How much the fluid pushes entities up.
    *   **Damage Per Tick**: How much damage the fluid deals to entities inside it.
    *   **Status Effect**: A status effect to apply to entities inside the fluid.
    *   **Burns Entities**: Whether the fluid sets entities on fire.
    *   **Supports Boats**: Whether boats can float on the fluid.
3.  **Generate**: Click the "Generate Fluid Pack" button.
4.  **Download**: Your browser will download a `.mcaddon` file.
5.  **Import**: Open the downloaded file to import it into Minecraft.