const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

// --- Middleware ---
// Enable CORS for all routes
app.use(cors());
// Serve static files from the root directory (for index.html, etc.)
app.use(express.static(path.join(__dirname)));
// Parse JSON bodies for POST requests
app.use(express.json());

// --- Routes ---
// Route to serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint for generating the fluid pack
app.post('/generate', (req, res) => {
  console.log('Received fluid configuration:', req.body);

  // --- Placeholder for Generation Logic ---
  // (This is where we will call the generator.js module in Phase 2)
  
  // For now, just send a success response
  res.status(200).json({ message: 'Configuration received. Generation logic not yet implemented.' });
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Fluid Generator server listening at http://localhost:${port}`);
});
