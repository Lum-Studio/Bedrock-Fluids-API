document.getElementById('fluidForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const generateButton = document.getElementById('generateButton');
    const statusMessage = document.getElementById('statusMessage');

    generateButton.disabled = true;
    statusMessage.textContent = 'Reading user input...';

    const config = {
        name: document.getElementById('fluidName').value,
        id: document.getElementById('fluidID').value,
        fogColor: document.getElementById('fogColor').value,
        buoyancy: parseFloat(document.getElementById('buoyancy').value),
        damage: parseInt(document.getElementById('damage').value),
        lightLevel: parseInt(document.getElementById('lightLevel').value),
        effect: document.getElementById('effect').value,
        burnsEntities: document.getElementById('burnsEntities').checked,
        supportsBoats: document.getElementById('supportsBoats').checked,
    };
    const textureFile = document.getElementById('texture').files[0];
    const bucketTextureFile = document.getElementById('bucketTexture').files[0];
    const packIconFile = document.getElementById('packIcon').files[0];

    try {
        const textureBuffer = await textureFile.arrayBuffer();
        const bucketTextureBuffer = await bucketTextureFile.arrayBuffer();
        
        let packIconBuffer;
        if (packIconFile) {
            packIconBuffer = await packIconFile.arrayBuffer();
        } else {
            // Fetch the default icon if none is provided
            const response = await fetch('pack_icon.png');
            if (!response.ok) throw new Error('Could not load default pack icon.');
            packIconBuffer = await response.arrayBuffer();
        }

        statusMessage.textContent = 'Generating assets...';

        const zip = new JSZip();
        const safeId = config.id.replace(':', '_');
        const namespace = config.id.split(':')[0];
        const packName = `${config.name} Fluid Pack`;
        const packDesc = `A custom fluid pack for ${config.name}. Made with Bedrock Fluids API.`;

        // --- Generate Core Assets ---
        const geometry = generateGeometries();
        const blockJson = getBlockJson(config);
        const bucketJson = getBucketItemJson(config);
        
        const hexColor = config.fogColor.substring(1); // Remove '#'
        const fogIdentifier = `lumstudio:${hexColor}_fog`;
        const fogJson = new FogGenerator(fogIdentifier)
            .setDistance("air", 0.0, 15.0, config.fogColor)
            .setDistance("weather", 0.0, 15.0, config.fogColor)
            .build();
        
        // --- Generate Manifests ---
        const bpManifest = getManifestJson(packName, packDesc, "behaviors");
        const rpManifest = getManifestJson(packName, packDesc, "resources");

        // --- Behavior Pack (BP) ---
        const bp = zip.folder('BP');
        bp.file('pack_icon.png', packIconBuffer);
        bp.file('manifest.json', JSON.stringify(bpManifest, null, 2));
        bp.folder('blocks').file(`${safeId}.json`, JSON.stringify(blockJson, null, 2));
        bp.folder('items').file(`${safeId}_bucket.json`, JSON.stringify(bucketJson, null, 2));
        
        // --- Scripting Engine ---
        const scriptsFolder = bp.folder('scripts');
        const scriptFiles = [
            'refactored_scripts/main.js',
            'refactored_scripts/fluids.js',
            'refactored_scripts/BlockUpdate.js',
            'refactored_scripts/queue.js',
            'refactored_scripts/effects/index.js',
            'refactored_scripts/effects/damage.js',
            'refactored_scripts/effects/burn.js',
            'refactored_scripts/effects/statusEffect.js',
            'refactored_scripts/effects/boat.js',
        ];

        for (const filePath of scriptFiles) {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Failed to fetch script: ${filePath}`);
            const content = await response.text();
            const zipPath = filePath.replace('refactored_scripts/', '');
            scriptsFolder.file(zipPath, content);
        }
        // Add the dynamically generated registry
        scriptsFolder.file('registry.js', getRegistryScript(config));

        // --- Resource Pack (RP) ---
        const rp = zip.folder('RP');
        rp.file('pack_icon.png', packIconBuffer);
        rp.file('manifest.json', JSON.stringify(rpManifest, null, 2));
        rp.folder('fogs').file(`${hexColor}_fog.json`, JSON.stringify(fogJson, null, 2));
        const blocksRpJson = { "format_version": [1, 1, 0], [config.id]: { "sound": "bucket.fill_lava", "textures": safeId } };
        const itemTextureJson = {
            resource_pack_name: "vanilla",
            texture_name: "atlas.items",
            texture_data: { [`${safeId}_bucket`]: { textures: `textures/items/${safeId}_bucket` } }
        };
        const terrainTextureJson = {
            resource_pack_name: "vanilla",
            texture_name: "atlas.terrain",
            padding: 8,
            num_mip_levels: 4,
            texture_data: { [safeId]: { textures: `textures/blocks/${safeId}` } }
        };
        rp.file('blocks.json', JSON.stringify(blocksRpJson, null, 2));
        rp.folder('textures').file('item_texture.json', JSON.stringify(itemTextureJson, null, 2));
        rp.folder('textures').file('terrain_texture.json', JSON.stringify(terrainTextureJson, null, 2));
        rp.folder('models/blocks').file('fluid_geometry.json', JSON.stringify(geometry, null, 2));
        rp.folder('textures/blocks').file(`${safeId}.png`, textureBuffer);
        rp.folder('textures/items').file(`${safeId}_bucket.png`, bucketTextureBuffer);

        // --- Generate and Trigger Download ---
        statusMessage.textContent = 'Zipping files...';
        const blob = await zip.generateAsync({ type: 'blob' });
        const filename = `${config.name.replace(/\s/g, '_')}_Addon.mcaddon`;
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(a.href);
        document.body.removeChild(a);

        statusMessage.textContent = 'Generation complete! Check your downloads.';
    } catch (error) {
        console.error('Error:', error);
        statusMessage.textContent = `Error: ${error.message}`;
    } finally {
        generateButton.disabled = false;
    }
});
