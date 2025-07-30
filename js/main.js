document.getElementById('fluidForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const generateButton = document.getElementById('generateButton');
      const statusMessage = document.getElementById('statusMessage');

      generateButton.disabled = true;
      statusMessage.textContent = 'Reading files...';

      const config = {
        name: document.getElementById('fluidName').value,
        id: document.getElementById('fluidID').value,
        fogColor: document.getElementById('fogColor').value,
        buoyancy: parseFloat(document.getElementById('buoyancy').value),
        damage: parseInt(document.getElementById('damage').value),
        effect: document.getElementById('effect').value,
        burnsEntities: document.getElementById('burnsEntities').checked,
        supportsBoats: document.getElementById('supportsBoats').checked,
      };
      const textureFile = document.getElementById('texture').files[0];
      const bucketTextureFile = document.getElementById('bucketTexture').files[0];

      try {
        const textureBuffer = await textureFile.arrayBuffer();
        const bucketTextureBuffer = await bucketTextureFile.arrayBuffer();
        statusMessage.textContent = 'Generating assets...';

        const zip = new JSZip();
        const safeId = config.id.replace(':', '_');
        const packName = `${config.name} Fluid Pack`;
        const packDesc = `A custom fluid pack for ${config.name}.`;

        // Generate core assets
        const geometry = generateGeometries();
        const permutations = generatePermutations();
        const blockJson = getBlockJson(config, permutations);
        const bucketJson = getBucketItemJson(config);
        const registrationScript = getRegistrationScript(config);

        // Generate manifests
        const bpManifest = getManifestJson(packName, packDesc, "data");
        const rpManifest = getManifestJson(packName, packDesc, "resources");
        
        // Add BP files
        const bp = zip.folder('BP');
        bp.file('manifest.json', JSON.stringify(bpManifest, null, 2));
        bp.folder('blocks').file(`${safeId}.json`, JSON.stringify(blockJson, null, 2));
        bp.folder('items').file(`${safeId}_bucket.json`, JSON.stringify(bucketJson, null, 2));
        
        const scriptsFolder = bp.folder('scripts');
        scriptsFolder.file('API.js', JSON.parse(API_JS_CONTENT));
        scriptsFolder.file('BlockUpdate.js', JSON.parse(BLOCKUPDATE_JS_CONTENT));
        scriptsFolder.file('fluids.js', JSON.parse(FLUIDS_JS_CONTENT));
        scriptsFolder.file('queue.js', JSON.parse(QUEUE_JS_CONTENT));
        scriptsFolder.folder('generated').file('register_fluids.js', registrationScript);

        // Add RP files
        const rp = zip.folder('RP');
        rp.file('manifest.json', JSON.stringify(rpManifest, null, 2));
        const blocksJson = { [config.id]: { "sound": "bucket.fill_lava", "textures": safeId } };
        const itemTextureJson = {
            "resource_pack_name": "vanilla", "texture_name": "atlas.items",
            "texture_data": { [`${safeId}_bucket`]: { "textures": `textures/items/${safeId}_bucket` } }
        };
        const terrainTextureJson = {
            "resource_pack_name": "vanilla", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
            "texture_data": { [safeId]: { "textures": `textures/blocks/${safeId}` } }
        };
        rp.file('blocks.json', JSON.stringify(blocksJson, null, 2));
        rp.file('item_texture.json', JSON.stringify(itemTextureJson, null, 2));
        rp.file('terrain_texture.json', JSON.stringify(terrainTextureJson, null, 2));
        rp.folder('models').folder('blocks').file('fluid_geometry.json', JSON.stringify(geometry, null, 2));
        rp.folder('textures').folder('blocks').file(`${safeId}.png`, textureBuffer);
        rp.folder('textures').folder('items').file(`${safeId}_bucket.png`, bucketTextureBuffer);

        // Generate and trigger download
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