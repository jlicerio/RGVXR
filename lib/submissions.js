/**
 * Submission & Review handlers — extracted from server.js (Phase 2, Fable refactor).
 *
 * Behavior-preserving extraction of:
 *   POST /api/submit        — submit a new project for review
 *   GET  /api/review        — list projects pending review (admin)
 *   PATCH /api/review/:id   — approve or reject a project
 *
 * Dependencies are injected via mount(app, { config, rootDir, scanProjects })
 * so the module is testable without the full Express server.
 *
 * TODO(auth): GET/PATCH /api/review have no authentication — see the
 *             original server.js TODO comment preserved below.
 */

const path = require('path');
const fs = require('fs');

/**
 * Mount submission and review routes onto an Express app.
 *
 * @param {import('express').Application} app
 * @param {Object} deps
 * @param {Object} deps.config        — parsed config.yaml
 * @param {string} deps.rootDir       — project root (__dirname of server.js)
 * @param {Function} deps.scanProjects — () => Project[]
 */
function mount(app, { config, rootDir, scanProjects }) {

    // ── Submission API ───────────────────────────────────────

    // POST /api/submit — submit a new project for review
    app.post('/api/submit', (req, res) => {
        if (!config.submissions?.enabled) {
            return res.status(403).json({ error: 'Submissions are currently disabled' });
        }

        const { title, description, author, email, technologies, unlockMethods, license } = req.body;

        // Validate required fields
        const required = config.submissions?.requiredFields || ['title', 'description', 'author'];
        const missing = required.filter(f => !req.body[f]);
        if (missing.length) {
            return res.status(400).json({ error: 'Missing required fields', fields: missing });
        }

        // Generate project ID from title
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const stagingDir = path.join(rootDir, config.submissions?.stagingPath || './projects/_staging');
        const projectDir = path.join(stagingDir, id);

        // Create staging directory
        fs.mkdirSync(projectDir, { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

        // Write manifest
        const manifest = {
            id,
            title,
            description: description || '',
            author: author || '',
            email: email || '',
            technologies: technologies || [],
            unlockMethods: unlockMethods || {},
            license: license || config.projects?.defaults?.license || 'CC-BY-4.0',
            status: 'review',
            visibility: 'unlisted',
            version: '1.0.0',
            submitted: new Date().toISOString(),
            reviewedBy: null
        };

        fs.writeFileSync(path.join(projectDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

        // Write placeholder index.html (model-viewer template)
        const viewerHTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | RGVXR</title>
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.2.0/model-viewer.min.js"></script>
<style>body{margin:0;background:#000;height:100vh}model-viewer{width:100%;height:100%}</style>
</head>
<body>
<model-viewer src="assets/asset.glb" camera-controls ar ar-modes="webxr scene-viewer quick-look" shadow-intensity="0.7" exposure="1" environment-image="neutral" auto-rotate></model-viewer>
</body></html>`;

        fs.writeFileSync(path.join(projectDir, 'index.html'), viewerHTML);

        console.log(`[submit] New project "${title}" (${id}) submitted for review`);

        res.status(201).json({
            success: true,
            project: { id, title, status: 'review' },
            message: 'Project submitted for review. Upload your GLB model to complete the submission.',
            nextSteps: [
                `Upload your .glb model to: ${projectDir}/assets/asset.glb`,
                `Your project will be reviewed and published shortly.`
            ]
        });
    });

    // ── Review API ───────────────────────────────────────────

    // GET /api/review — list projects in review/draft status (admin)
    app.get('/api/review', (req, res) => {
        // TODO: Add admin auth
        const projects = scanProjects();
        const reviewProjects = projects.filter(p => p.status === 'review' || p.status === 'draft');

        // Also scan staging
        const stagingDir = path.join(rootDir, config.submissions?.stagingPath || './projects/_staging');
        if (fs.existsSync(stagingDir)) {
            const stagingEntries = fs.readdirSync(stagingDir, { withFileTypes: true });
            for (const entry of stagingEntries) {
                if (!entry.isDirectory()) continue;
                const manifestPath = path.join(stagingDir, entry.name, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        reviewProjects.push({
                            id: m.id,
                            directory: `_staging/${entry.name}`,
                            title: m.title,
                            description: m.description,
                            author: m.author,
                            status: m.status,
                            submitted: m.submitted,
                            _staging: true
                        });
                    } catch (e) {}
                }
            }
        }

        res.json(reviewProjects);
    });

    // PATCH /api/review/:id — approve/reject a project
    app.patch('/api/review/:id', (req, res) => {
        const { action, notes } = req.body; // action: 'approve' | 'reject'
        const projectId = req.params.id;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
        }

        // Find project in staging first
        const stagingDir = path.join(rootDir, config.submissions?.stagingPath || './projects/_staging');
        const stagingProjectDir = path.join(stagingDir, projectId);

        if (fs.existsSync(stagingProjectDir)) {
            const manifestPath = path.join(stagingProjectDir, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

                if (action === 'approve') {
                    // Move from staging to projects
                    const targetDir = path.join(rootDir, config.projects?.path || './projects', projectId);
                    fs.renameSync(stagingProjectDir, targetDir);

                    manifest.status = 'published';
                    manifest.reviewedBy = notes || 'admin';
                    manifest.published = new Date().toISOString();
                    fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

                    return res.json({ success: true, action: 'approved', project: { id: projectId, status: 'published' } });
                } else {
                    manifest.status = 'rejected';
                    manifest.reviewedBy = notes || 'admin';
                    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                    return res.json({ success: true, action: 'rejected', project: { id: projectId, status: 'rejected' } });
                }
            }
        }

        // Check main projects dir
        const projectsDir = path.join(rootDir, config.projects?.path || './projects');
        const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name.toLowerCase().replace(/\s+/g, '-') === projectId);

        if (projectDirs.length > 0) {
            const projectDir = path.join(projectsDir, projectDirs[0].name);
            const manifestPath = path.join(projectDir, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                manifest.status = action === 'approve' ? 'published' : 'rejected';
                manifest.reviewedBy = notes || 'admin';
                fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
                return res.json({ success: true, action, project: { id: projectId, status: manifest.status } });
            }
        }

        res.status(404).json({ error: 'Project not found in staging or projects' });
    });
}

module.exports = { mount };
