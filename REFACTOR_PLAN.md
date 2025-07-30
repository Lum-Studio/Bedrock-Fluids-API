# Refactor Plan: Full-Stack JavaScript Fluid Generator

This document outlines the plan to refactor the entire fluid generation system from a disconnected set of Python scripts and a frontend into a single, cohesive full-stack JavaScript application.

The core of this plan is to create a Node.js server using the Express.js framework. This server will handle everything: serving the frontend, running the generation logic, and packaging the final file.

---

### **Phase 1: Setting Up the Node.js Environment**

First, we'll set up the project structure and the basic web server.

1.  **Initialize a Node.js Project:**
    *   In your project's root directory, run this command to create a `package.json` file. This file will track our project's dependencies.
        ```bash
        npm init -y
        ```

2.  **Install Dependencies:**
    *   We'll need a few packages from npm (the Node Package Manager):
        *   `express`: The web server framework.
        *   `jszip`: A library for creating `.zip` files in JavaScript.
        *   `cors`: (Optional but recommended) To handle cross-origin requests smoothly.
    *   Run this command to install them:
        ```bash
        npm install express jszip cors
        ```

3.  **Create the Server File (`server.js`):**
    *   Create a new file named `server.js`.
    *   This file will contain the initial server code to:
        1.  Serve the `index.html` file and any other static assets (CSS, frontend JS).
        2.  Create a `/generate` API endpoint that listens for `POST` requests from the frontend.

---

### **Phase 2: Porting the Python Asset Generator to JavaScript**

This is the most intensive part. We will rewrite the logic from `generate_fluid_assets.py` in pure JavaScript.

1.  **Create a Generator Module (`generator.js`):**
    *   Create a new file named `generator.js`. This will be a library of functions that our `server.js` can call.
    *   **Port the Geometry Logic:**
        *   Translate the `generate_model` function from Python to a JavaScript function. The math, loops, and object creation will translate directly.
        *   Translate the `generate_geometries` function. It will call your new `generateModel` function in a loop and build a large JavaScript object.
    *   **Port the Permutation Logic:**
        *   Translate the `fluid_state_from_level` and `generate_permutations` functions to JavaScript.
    *   The module will export a main function, e.g., `generateCoreAssets()`, that returns the two large JSON objects (geometries and permutations).

---

### **Phase 3: Implementing the "Compiler" Logic in JavaScript**

Next, we'll implement the file-generation logic from `COMPILER_DESIGN.md` using Node.js's built-in `fs` (File System) module.

1.  **Expand `generator.js`:**
    *   Add new functions that take the `config` object from the frontend as input.
    *   **Create File Generation Functions:**
        *   `createBlockFile(config, path)`: Creates the fluid's block definition JSON file.
        *   `createBucketItemFile(config, path)`: Creates the bucket item JSON file.
        *   `updateBlocksJson(config, path)`: Reads the existing `blocks.json`, adds the new fluid entry, and writes it back.
        *   `createJsRegistration(config, path)`: Generates the `register_fluids.js` file.
    *   These functions will use `fs.writeFileSync()` to create files and `fs.mkdirSync()` to create directories.

---

### **Phase 4: Integrating Frontend, Backend, and Packaging**

This final phase connects all the pieces.

1.  **Update `index.html`:**
    *   Modify the `<script>` tag to `fetch` the `/generate` endpoint on your Node.js server.
    *   It will send the form data as a JSON payload.
    *   It will expect a file (the zip archive) in response and will trigger a browser download.

2.  **Flesh out the `/generate` Endpoint in `server.js`:**
    *   This endpoint will be the main controller. When it receives a request:
        1.  It will call the functions in `generator.js`, passing in the user's configuration.
        2.  The generator will create the complete `BP fluids` and `RP fluids` folders in a temporary directory (e.g., `./tmp/fluid_12345`).
        3.  **Zipping:** Using the `jszip` library, the server will read the contents of the temporary directory and create a zip buffer in memory.
        4.  **Sending the Response:** The server will send the zip buffer back to the user with the correct headers (`Content-Type: application/zip`) to trigger the download.
        5.  **Cleanup:** The server will delete the temporary directory.

3.  **Add a Start Script:**
    *   In your `package.json`, add a `start` script to make running the server easy:
        ```json
        "scripts": {
          "start": "node server.js"
        }
        ```
    *   You can then start the entire application with a single command: `npm start`.
