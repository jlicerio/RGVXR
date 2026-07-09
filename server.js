/**
 * RGVXR Platform Server
 * Modular AR experience platform — Express API + connector system
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const yaml = require('js-yaml');
const { scanProjects: _scanModule } = require('./lib/project-scanner');

const app = express();

// ── Load config ──────────────────────────────────────────
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, 'config.yaml'), 'utf8'));
} catch (e) {
    console.error('Failed to load config.yaml:', e.message);
    process.exit(1);
}

const PORT = process.env.PORT || config.server?.port || 8080;
const HOST = config.server?.host || '0.0.0.0';

// ── Initialize connector system ──────────────────────────
let registry;
try {
    registry = require('./modules/registry');
    registry.initConnectors();
} catch (e) {
    console.warn('Connector system not available:', e.message);
    registry = { checkUnlock: () => ({ unlocked: true, reason: 'no connectors', by: null }), getConnectorsInfo: () => [] };
}

// ── Middleware ───────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ── Static files ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // Serve root files (config, etc.)

// ── Health check ─────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        platform: config.platform?.name || 'RGVXR',
        version: config.platform?.version || '2.0.0',
        uptime: process.uptime(),
        connectors: registry.getConnectorsInfo().map(c => ({ id: c.id, ready: c.ready }))
    });
});

// ── Platform config endpoint (public, safe subset) ───────
app.get('/api/config', (req, res) => {
    res.json({
        platform: config.platform,
        gallery: config.gallery,
        viewer: config.viewer,
        connectors: registry.getConnectorsInfo(),
        submissions: { enabled: config.submissions?.enabled || false }
    });
});

// ── Projects API ─────────────────────────────────────────

// Scan projects directory for manifests
// Delegated to lib/project-scanner.js (behavior-preserving extraction)
// Scan projects directory for manifests
// Delegated to lib/project-scanner.js (behavior-preserving extraction)
function scanProjects() {
    return _scanModule(config);
}

// GET /api/projects — list all projects (filters: status, visibility)
app.get('/api/projects', (req, res) => {
    try {
        let projects = scanProjects();
        
        // Filter by status if requested
        if (req.query.status) {
            projects = projects.filter(p => p.status === req.query.status);
        } else {
            // Default: only published
            projects = projects.filter(p => p.status === 'published');
        }
        
        // Filter by visibility
        if (req.query.visibility) {
            projects = projects.filter(p => p.visibility === req.query.visibility);
        }
        
        // Check unlock status if user location provided
        if (req.query.lat && req.query.lng) {
            const userLoc = { lat: parseFloat(req.query.lat), lng: parseFloat(req.query.lng) };
            projects.forEach(p => {
                if (p.unlockMethods && Object.keys(p.unlockMethods).length > 0) {
                    const result = registry.checkUnlock(p, { userLocation: userLoc });
                    p._unlocked = result.unlocked;
                    p._unlockReason = result.reason;
                    p._unlockBy = result.by;
                } else {
                    p._unlocked = true;
                    p._unlockReason = 'no restrictions';
                }
            });
        }
        
        res.json(projects);
    } catch (err) {
        console.error('Error scanning projects:', err);
        res.status(500).json({ error: 'Failed to scan projects', message: err.message });
    }
});

// GET /api/projects/:id — single project detail
app.get('/api/projects/:id', (req, res) => {
    const projects = scanProjects();
    const project = projects.find(p => p.id === req.params.id || p.directory === req.params.id);
    
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // Full manifest load
    const projectPath = path.join(__dirname, config.projects?.path || './projects', project.directory);
    const manifestPath = path.join(projectPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            project._manifest = manifest;
        } catch (e) {}
    }
    
    // Unlock check
    if (req.query.lat && req.query.lng) {
        const result = registry.checkUnlock(project, {
            userLocation: { lat: parseFloat(req.query.lat), lng: parseFloat(req.query.lng) }
        });
        project._unlocked = result.unlocked;
        project._unlockReason = result.reason;
    }
    
    res.json(project);
});

// ── Submission & Review API ──────────────────────────────
// Delegated to lib/submissions.js (behavior-preserving extraction)
const submissions = require('./lib/submissions');
submissions.mount(app, { config, rootDir: __dirname, scanProjects });

// ── Connector status endpoint ────────────────────────────
app.get('/api/connectors', (req, res) => {
    res.json(registry.getConnectorsInfo());
});

// ── Fallback: serve index.html for SPA routing ───────────
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) return next();
    
    // If path looks like a file with extension, let static handle it
    if (path.extname(req.path)) return next();
    
    // Serve main gallery
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        next();
    }
});

// ── Start ────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║   RGVXR Platform v${config.platform?.version || '2.0.0'}               ║`);
    console.log(`  ║   http://${HOST}:${PORT}                      ║`);
    console.log(`  ║   Connectors: ${registry.getConnectorsInfo().filter(c => c.ready).length} active                 ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
});
