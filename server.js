const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const JSZip = require('jszip');
const { generateFluidPack } = require('./generator.js');

const app = express();
const port = 3000;

// --- Middleware & Setup ---
app.use(cors());
app.use(express.static(path.join(__dirname))); // Serve static files

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// --- Routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint for generating the fluid pack
app.post('/generate', upload.single('texture'), async (req, res) => {
    const config = req.body;
    console.log('Received fluid configuration:', config);
    
    const tempDir = path.join(__dirname, `temp_${Date.now()}`);
    const outputZip = `${tempDir}.zip`;

    try {
        // 1. Generate the file structure
        fs.mkdirSync(tempDir, { recursive: true });
        generateFluidPack(config, tempDir);

        // 2. Copy the uploaded texture
        if (req.file) {
            const safeId = config.id.replace(':', '_');
            const texturePath = path.join(tempDir, 'RP', 'textures', 'blocks', `${safeId}.png`);
            fs.copyFileSync(req.file.path, texturePath);
            // TODO: Also create a bucket texture, for now we reuse the main one
            const bucketTexturePath = path.join(tempDir, 'RP', 'textures', 'items', `${safeId}_bucket.png`);
            fs.copyFileSync(req.file.path, bucketTexturePath);
        }

        // 3. Create a zip archive
        const zip = new JSZip();
        const bpDir = path.join(tempDir, 'BP');
        const rpDir = path.join(tempDir, 'RP');
        
        // Add BP folder
        const bpFiles = getAllFiles(bpDir);
        for (const file of bpFiles) {
            const relativePath = path.relative(bpDir, file);
            zip.folder('BP').file(relativePath, fs.readFileSync(file));
        }

        // Add RP folder
        const rpFiles = getAllFiles(rpDir);
        for (const file of rpFiles) {
            const relativePath = path.relative(rpDir, file);
            zip.folder('RP').file(relativePath, fs.readFileSync(file));
        }

        // 4. Send the zip file to the user
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${config.name.replace(/\s/g, '_')}_Pack.zip"`
        });
        res.send(zipBuffer);

    } catch (error) {
        console.error('Error during pack generation:', error);
        res.status(500).json({ message: 'Failed to generate fluid pack.', error: error.message });
    } finally {
        // 5. Cleanup temporary files
        if (req.file) fs.unlinkSync(req.file.path);
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

// --- Server Start ---
app.listen(port, () => {
    console.log(`Fluid Generator server listening at http://localhost:${port}`);
});

// --- Utility Functions ---
function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}