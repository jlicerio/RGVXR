const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const arEditor = require('./debug/ar-editor.js');
const blenderApi = require('./backup_/blender/blender-api-simple.js');
const webxrTests = require('./debug/webxr-tests.js');
const multer = require('multer');
const upload = multer({ dest: 'public/audio/' });
const app = express();
const debugEnabled = process.env.DEBUG === 'true';
let debugModeActive = debugEnabled;

// Get port from environment variable for Heroku compatibility, fallback to port.js or default
let port = process.env.PORT || 8080;
try {
    if (fs.existsSync('./port.js') && !process.env.PORT) {
        port = require('./port.js');
    }
} catch (error) {
    console.warn('Could not read port.js, using default port 8080');
}

// Define paths to AR projects
const arObjectPath = path.join(__dirname, 'projects', 'ar object');
const arStakesPath = path.join(__dirname, 'projects', 'ar stakes');

// Enable CORS for AR.js
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Add this near the top of the file, after the app is created
app.use(express.json()); // Add middleware to parse JSON bodies

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint for projects - MUST be defined BEFORE static file middleware
app.get('/api/projects', (req, res) => {
    try {
        console.log('Scanning projects...');
        const projects = scanProjects();
        console.log('Projects found:', projects);
        res.json(projects);
    } catch (err) {
        console.error('Error reading projects:', err);
        res.status(500).json({ error: 'Failed to read projects' });
    }
});

// API test endpoint
app.get('/api/test', (req, res) => {
    res.json({ status: 'API is working' });
});

// Add routes for AR projects
app.get('/ar-object', (req, res) => {
    res.sendFile(path.join(arObjectPath, 'index.html'));
});

app.get('/ar-stakes', (req, res) => {
    res.sendFile(path.join(arStakesPath, 'index.html'));
});

// Serve static files for AR projects
app.use('/projects/ar object', express.static(arObjectPath));
app.use('/projects/ar stakes', express.static(arStakesPath));

// Serve static files from root directory
app.use(express.static('./'));

// Add this after the API endpoints but before the static file middleware
app.get('/api/debug/toggle', (req, res) => {
    // Toggle debug mode
    debugModeActive = !debugModeActive;
    console.log(`Debug mode ${debugModeActive ? 'enabled' : 'disabled'}`);
    res.json({ debug: debugModeActive });
});

// Check debug mode status
app.get('/api/debug/status', (req, res) => {
    res.json({ debug: debugModeActive });
});

// Conditionally serve debug tools
app.use('/debug', (req, res, next) => {
    if (debugModeActive) {
        // Serve debug files only when debug mode is active
        express.static(path.join(__dirname, 'debug'))(req, res, next);
    } else {
        // Return 404 when debug mode is not active
        res.status(404).send('Debug mode is not enabled');
    }
});

// Add debug API endpoints only when debug mode is active
app.get('/api/debug/scan', (req, res) => {
    if (!debugModeActive) {
        return res.status(404).send('Debug mode is not enabled');
    }
    
    const projects = scanProjects();
    res.json({
        projectsCount: projects.length,
        projects: projects,
        directories: fs.readdirSync(path.join(__dirname, 'projects')),
        serverInfo: {
            port: port,
            nodeVersion: process.version,
            platform: process.platform
        }
    });
});

// Add a mobile detection endpoint
app.get('/api/device-info', (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(userAgent);
    
    res.json({
        isMobile,
        isIOS,
        isAndroid,
        userAgent
    });
});

// Add this route to handle direct project access
app.get('/project/:id', (req, res) => {
    const projectId = req.params.id;
    
    // Redirect to the main page with the project hash
    res.redirect(`/#${projectId}`);
});

// Add this before your static file middleware
app.use((req, res, next) => {
    // Block any test-related files
    if (req.url.startsWith('/webxr-tests') || 
        req.url.startsWith('/test/') || 
        req.url === '/test-links.html') {
        return res.status(404).send('Not found - Please use the test server on port 8081');
    }
    next();
});

// Update the scanProjects function to better utilize metadata
function scanProjects() {
    const projectsDir = path.join(__dirname, 'projects');
    let projects = [];
    
    console.log('Scanning directory for projects:', projectsDir);
    
    try {
        const items = fs.readdirSync(projectsDir);
        items.forEach(item => {
            const projectPath = path.join(projectsDir, item);
            
            if (fs.statSync(projectPath).isDirectory()) {
                const indexPath = path.join(projectPath, 'index.html');
                
                // Get metadata first
                const metadata = validateProjectMetadata(projectPath);
                console.log(`Metadata for ${item}:`, metadata);
                
                if (fs.existsSync(indexPath)) {
                    const project = {
                        id: item.toLowerCase().replace(/\s+/g, '-'),
                        name: item,
                        path: `/projects/${item}/index.html`,
                        ...(metadata || {}),  // Spread metadata if it exists
                        lastModified: fs.statSync(indexPath).mtime,
                        hasMetadata: !!metadata
                    };
                    
                    console.log(`Final project object:`, project);
                    projects.push(project);
                }
            }
        });
    } catch (error) {
        console.error('Error scanning projects:', error);
    }
    
    return projects;
}

// Add this after the scanProjects function
function ensureMetadataTemplates() {
    // Only run in debug mode to avoid file operations in production
    if (!debugModeActive) return;
    
    console.log('Checking for projects without metadata...');
    
    const projectsDir = path.join(__dirname, 'projects');
    
    try {
        // Check if projects directory exists
        if (!fs.existsSync(projectsDir)) return;
        
        // Read the projects directory
        const items = fs.readdirSync(projectsDir);
        
        // Check each project folder
        for (const item of items) {
            const itemPath = path.join(projectsDir, item);
            
            try {
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory()) {
                    // Check if the directory has an index.html file (confirming it's a project)
                    const indexPath = path.join(itemPath, 'index.html');
                    
                    if (fs.existsSync(indexPath)) {
                        // Check if metadata.json already exists
                        const metadataPath = path.join(itemPath, 'metadata.json');
                        
                        if (!fs.existsSync(metadataPath)) {
                            console.log(`Creating metadata template for project: ${item}`);
                            
                            // Get project title from the HTML file to customize template
                            const content = fs.readFileSync(indexPath, 'utf8');
                            const titleMatch = content.match(/<title>(.*?)<\/title>/i);
                            const title = titleMatch ? titleMatch[1] : item;
                            
                            // Create metadata template
                            const metadataTemplate = {
                                "description": `The ${title} project demonstrates augmented reality capabilities using web technologies.`,
                                "author": "AR Projects Team",
                                "technologies": ["A-Frame", "AR.js", "WebXR"],
                                "instructions": "Point your camera at the marker pattern to view the AR content."
                            };
                            
                            // Write the template file
                            fs.writeFileSync(
                                metadataPath, 
                                JSON.stringify(metadataTemplate, null, 4),
                                'utf8'
                            );
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing item ${item}:`, error);
            }
        }
    } catch (error) {
        console.error('Error checking for metadata templates:', error);
    }
}

// Call this function when the server starts
ensureMetadataTemplates();

// Modify the SSL configuration to be optional
let server;
try {
    // Use HTTP server when on Heroku (PORT env variable is set)
    if (process.env.PORT) {
        console.log('Running on Heroku, using HTTP server');
        server = require('http').createServer(app);
    } else {
        const sslOptions = {
            key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
            cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
        };
        server = https.createServer(sslOptions, app);
        console.log('HTTPS server created successfully');
    }
} catch (error) {
    console.log('SSL certificates not found or error creating secure server, falling back to HTTP');
    server = require('http').createServer(app);
}

// Start the server with better error handling
try {
    const localIP = getLocalIP();
    const isHeroku = process.env.PORT ? true : false;
    
    // On Heroku, we bind to all interfaces (0.0.0.0)
    server.listen(port, '0.0.0.0', () => {
        const protocol = server instanceof https.Server ? 'https' : 'http';
        console.log(`\nServer running at ${protocol}://localhost:${port}`);
        
        if (!isHeroku) {
            console.log(`Local network access: ${protocol}://${localIP}:${port}`);
        } else {
            console.log('Running on Heroku deployment');
        }
        
        if (debugEnabled) {
            console.log('\nDebug mode enabled:');
            setupDebugMode();
        }
    });
    
    // Handle server errors
    server.on('error', (err) => {
        console.error('Server error:', err);
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use`);
        }
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down server...');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
    
} catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
}

// Fix the editor route registration in server.js
// Replace lines 332-343 with this:
if (debugModeActive) {
    // Import the AR editor router
    const arEditor = require('./debug/ar-editor.js');
    
    // Mount the AR editor at the correct path
    app.use('/debug/editor', express.static(path.join(__dirname, 'debug', 'editor')));
    
    // Mount the API endpoints directly
    app.use('/debug/api', arEditor);
    
    // Add a file permission diagnostic endpoint
    app.get('/debug/check-permissions', (req, res) => {
        const projectsDir = path.join(__dirname, 'projects');
        const results = {
            directory: projectsDir,
            readable: false,
            writable: false,
            files: []
        };
        
        try {
            // Check if projects directory is readable
            try {
                fs.accessSync(projectsDir, fs.constants.R_OK);
                results.readable = true;
            } catch (e) {
                results.readable = false;
            }
            
            // Check if projects directory is writable
            try {
                fs.accessSync(projectsDir, fs.constants.W_OK);
                results.writable = true;
            } catch (e) {
                results.writable = false;
            }
            
            // Check a few sample files
            if (results.readable) {
                const items = fs.readdirSync(projectsDir);
                
                for (const item of items.slice(0, 3)) {
                    const itemPath = path.join(projectsDir, item);
                    
                    if (fs.statSync(itemPath).isDirectory()) {
                        const indexPath = path.join(itemPath, 'index.html');
                        
                        if (fs.existsSync(indexPath)) {
                            let fileResult = {
                                path: indexPath,
                                readable: false,
                                writable: false
                            };
                            
                            try {
                                fs.accessSync(indexPath, fs.constants.R_OK);
                                fileResult.readable = true;
                            } catch (e) {
                                fileResult.readable = false;
                            }
                            
                            try {
                                fs.accessSync(indexPath, fs.constants.W_OK);
                                fileResult.writable = true;
                            } catch (e) {
                                fileResult.writable = false;
                            }
                            
                            results.files.push(fileResult);
                        }
                    }
                }
            }
            
            res.json(results);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    console.log('Debug mode: AR Editor enabled at /debug/editor');
    console.log('Debug mode: API endpoints available at /debug/api');
    console.log('Debug mode: Permission check available at /debug/check-permissions');
    console.log('\nNOTE: If files cannot be saved, run this command to make files writable:');
    console.log('  Windows: attrib -r projects\\*.* /s');
    console.log('  Mac/Linux: chmod -R +w projects/');
    
    // Mount the Blender API endpoints
    app.use('/api/blender', blenderApi);
    
    console.log('Debug mode: Blender API enabled at /api/blender');
    
    // Mount WebXR tests
    app.use('/debug/test', webxrTests);
    app.get('/debug/webxr-tests', (req, res) => {
        res.sendFile(path.join(__dirname, 'debug', 'webxr-test-dashboard.html'));
    });
    
    console.log('Debug mode: WebXR tests available at /debug/webxr-tests');
}

// Block debug paths for main server
app.use((req, res, next) => {
    // Block any debug-related paths
    if (req.url.startsWith('/debug/') || 
        req.url.startsWith('/test/') || 
        req.url === '/test-links.html' ||
        req.url.startsWith('/webxr-tests')) {
        return res.status(404).send('Not found - Please use the debug server on port 8081');
    }
    next();
});

// Handle root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper function to get local IP address
function getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '0.0.0.0';
}

function validateProjectMetadata(projectPath) {
    const metadataPath = path.join(projectPath, 'metadata.json');
    console.log('Checking metadata for:', projectPath);
    
    if (!fs.existsSync(metadataPath)) {
        console.log(`No metadata file found, creating for ${projectPath}`);
        const defaultMetadata = {
            "title": path.basename(projectPath),
            "description": `${path.basename(projectPath)} AR experience`,
            "author": "AR Projects Team",
            "version": "1.0.0",
            "technologies": ["A-Frame", "AR.js", "WebXR"],
            "instructions": ["Allow camera access when prompted"]
        };
        
        fs.writeFileSync(metadataPath, JSON.stringify(defaultMetadata, null, 4));
        console.log('Created default metadata');
        return defaultMetadata;
    } else {
        try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            console.log('Found existing metadata:', metadata);
            return metadata;
        } catch (error) {
            console.error('Error reading existing metadata:', error);
            return null;
        }
    }
}

// Audio file handling endpoints
app.post('/api/audio/upload', upload.single('audio'), (req, res) => {
    console.log('Audio upload received:', req.file);
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ 
        success: true, 
        filename: req.file.filename,
        path: `/audio/${req.file.filename}`
    });
});

app.get('/api/audio/list', (req, res) => {
    const audioDir = path.join(__dirname, 'public', 'audio');
    fs.readdir(audioDir, (err, files) => {
        if (err) {
            console.error('Error reading audio directory:', err);
            return res.status(500).json({ error: 'Failed to read audio directory' });
        }
        res.json(files.map(file => ({
            filename: file,
            path: `/audio/${file}`
        })));
    });
}); 