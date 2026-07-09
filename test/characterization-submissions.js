/**
 * Characterization test — pins submission and review API behavior.
 *
 * Tests the pure logic of lib/submissions.js by mounting routes onto
 * a lightweight Express app and making requests via supertest-style
 * manual injection (no network, no real DB).
 *
 * Uses a temp directory for staging so production data is never touched.
 *
 * Run with:  node test/characterization-submissions.js
 *
 * Exit code 0 = all assertions pass.
 * Exit code 1 = at least one assertion failed.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ============================================================
// Test harness (zero dependencies — same as characterization-unlock.js)
// ============================================================
let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        console.error(`  ✗ ${label}`);
        console.error(`    expected: ${JSON.stringify(expected)}`);
        console.error(`    actual:   ${JSON.stringify(actual)}`);
    }
}

function assertTruthy(label, actual) {
    if (actual) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        console.error(`  ✗ ${label}`);
        console.error(`    expected truthy, got: ${JSON.stringify(actual)}`);
    }
}

function assertIncludes(label, str, substr) {
    const ok = typeof str === 'string' && str.includes(substr);
    if (ok) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        console.error(`  ✗ ${label}`);
        console.error(`    expected "${substr}" to appear in: ${JSON.stringify(str)}`);
    }
}

// ============================================================
// Setup: temp dir + Express app with submissions mounted
// ============================================================
const express = require('express');

// Create a temp root that mimics the project layout
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rgvxr-test-'));
const stagingPath = './projects/_staging';
const projectsPath = './projects';

// Create dirs
fs.mkdirSync(path.join(tmpRoot, 'projects', '_staging'), { recursive: true });

// Minimal config matching production config.yaml
const config = {
    submissions: {
        enabled: true,
        stagingPath: stagingPath,
        requiredFields: ['title', 'description', 'author']
    },
    projects: {
        path: projectsPath,
        defaults: { license: 'CC-BY-4.0' }
    }
};

// Stub scanProjects — returns empty array for isolated testing
function scanProjects() {
    return [];
}

const app = express();
app.use(express.json());

// Mount the extracted module
const submissions = require('../lib/submissions');
submissions.mount(app, { config, rootDir: tmpRoot, scanProjects });

// Helper: make an HTTP request to the app and return { status, body }
function request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            const payload = body ? JSON.stringify(body) : null;
            const opts = {
                hostname: '127.0.0.1',
                port,
                path: urlPath,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
                }
            };
            const req = http.request(opts, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    server.close();
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });
            req.on('error', (e) => { server.close(); reject(e); });
            if (payload) req.write(payload);
            req.end();
        });
    });
}

// ============================================================
// Tests
// ============================================================
async function runTests() {

    // ── 1) Submit: disabled ──────────────────────────────
    console.log('\n=== CHARACTERIZATION: POST /api/submit (disabled) ===');
    {
        const disabledConfig = { ...config, submissions: { ...config.submissions, enabled: false } };
        const disabledApp = express();
        disabledApp.use(express.json());
        submissions.mount(disabledApp, { config: disabledConfig, rootDir: tmpRoot, scanProjects });

        const res = await new Promise((resolve, reject) => {
            const server = disabledApp.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                const payload = JSON.stringify({ title: 'x', description: 'x', author: 'x' });
                const req = http.request({
                    hostname: '127.0.0.1', port, path: '/api/submit', method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
                }, r => {
                    let d = ''; r.on('data', c => d += c);
                    r.on('end', () => { server.close(); resolve({ status: r.statusCode, body: JSON.parse(d) }); });
                });
                req.on('error', e => { server.close(); reject(e); });
                req.write(payload); req.end();
            });
        });
        assert('submit disabled → 403', res.status, 403);
        assert('submit disabled error msg', res.body.error, 'Submissions are currently disabled');
    }

    // ── 2) Submit: missing required fields ───────────────
    console.log('\n=== CHARACTERIZATION: POST /api/submit (missing fields) ===');
    {
        const res = await request('POST', '/api/submit', { title: 'Test' });
        assert('missing fields → 400', res.status, 400);
        assert('missing fields error', res.body.error, 'Missing required fields');
        assert('missing fields list', res.body.fields, ['description', 'author']);
    }

    // ── 3) Submit: valid submission ──────────────────────
    console.log('\n=== CHARACTERIZATION: POST /api/submit (valid) ===');
    {
        const res = await request('POST', '/api/submit', {
            title: 'Test AR Experience',
            description: 'A test submission',
            author: 'Test Author',
            email: 'test@example.com',
            technologies: ['model-viewer'],
            license: 'MIT'
        });

        assert('valid submit → 201', res.status, 201);
        assert('valid submit success', res.body.success, true);
        assert('valid submit id', res.body.project.id, 'test-ar-experience');
        assert('valid submit title', res.body.project.title, 'Test AR Experience');
        assert('valid submit status', res.body.project.status, 'review');
        assertTruthy('valid submit nextSteps', Array.isArray(res.body.nextSteps));
        assert('valid submit nextSteps length', res.body.nextSteps.length, 2);

        // Verify files were created
        const projectDir = path.join(tmpRoot, 'projects', '_staging', 'test-ar-experience');
        assertTruthy('staging dir exists', fs.existsSync(projectDir));
        assertTruthy('assets dir exists', fs.existsSync(path.join(projectDir, 'assets')));
        assertTruthy('manifest exists', fs.existsSync(path.join(projectDir, 'manifest.json')));
        assertTruthy('index.html exists', fs.existsSync(path.join(projectDir, 'index.html')));

        // Verify manifest content
        const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'manifest.json'), 'utf8'));
        assert('manifest id', manifest.id, 'test-ar-experience');
        assert('manifest status', manifest.status, 'review');
        assert('manifest visibility', manifest.visibility, 'unlisted');
        assert('manifest version', manifest.version, '1.0.0');
        assert('manifest license', manifest.license, 'MIT');
        assert('manifest email', manifest.email, 'test@example.com');
        assert('manifest author', manifest.author, 'Test Author');
        assert('manifest reviewedBy', manifest.reviewedBy, null);
        assertTruthy('manifest submitted is ISO date', manifest.submitted && manifest.submitted.includes('T'));

        // Verify index.html contains title
        const html = fs.readFileSync(path.join(projectDir, 'index.html'), 'utf8');
        assertIncludes('index.html has title', html, 'Test AR Experience | RGVXR');
        assertIncludes('index.html has model-viewer', html, 'model-viewer');
        assertIncludes('index.html has asset.glb ref', html, 'assets/asset.glb');
    }

    // ── 4) Submit: ID generation edge cases ──────────────
    console.log('\n=== CHARACTERIZATION: ID generation ===');
    {
        const res = await request('POST', '/api/submit', {
            title: '  ¡Hello World!  (Test) ',
            description: 'test',
            author: 'test'
        });
        assert('special chars → clean id', res.body.project.id, 'hello-world-test');
    }

    // ── 5) Submit: default license from config ───────────
    console.log('\n=== CHARACTERIZATION: default license ===');
    {
        const res = await request('POST', '/api/submit', {
            title: 'Default License Test',
            description: 'test',
            author: 'test'
        });
        const projectDir = path.join(tmpRoot, 'projects', '_staging', 'default-license-test');
        const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'manifest.json'), 'utf8'));
        assert('default license from config', manifest.license, 'CC-BY-4.0');
    }

    // ── 6) Review: list (empty) ──────────────────────────
    console.log('\n=== CHARACTERIZATION: GET /api/review ===');
    {
        const res = await request('GET', '/api/review');
        assert('review list → 200', res.status, 200);
        assertTruthy('review list is array', Array.isArray(res.body));
        // Should include our staged projects
        const staged = res.body.filter(p => p._staging);
        assertTruthy('review list includes staging entries', staged.length >= 1);
        const testEntry = staged.find(p => p.id === 'test-ar-experience');
        assertTruthy('test-ar-experience in staging list', !!testEntry);
        if (testEntry) {
            assert('staging entry status', testEntry.status, 'review');
            assert('staging entry _staging flag', testEntry._staging, true);
            assertIncludes('staging entry directory', testEntry.directory, '_staging/');
        }
    }

    // ── 7) Review: PATCH invalid action ──────────────────
    console.log('\n=== CHARACTERIZATION: PATCH /api/review/:id (invalid) ===');
    {
        const res = await request('PATCH', '/api/review/test-ar-experience', { action: 'foo' });
        assert('invalid action → 400', res.status, 400);
        assert('invalid action error', res.body.error, 'Action must be "approve" or "reject"');
    }

    // ── 8) Review: reject ────────────────────────────────
    console.log('\n=== CHARACTERIZATION: PATCH /api/review/:id (reject) ===');
    {
        // Submit a project to reject
        await request('POST', '/api/submit', {
            title: 'Reject Me',
            description: 'will be rejected',
            author: 'test'
        });

        const res = await request('PATCH', '/api/review/reject-me', {
            action: 'reject',
            notes: 'not ready'
        });
        assert('reject → 200', res.status, 200);
        assert('reject success', res.body.success, true);
        assert('reject action', res.body.action, 'rejected');
        assert('reject status', res.body.project.status, 'rejected');

        // Verify manifest was updated in staging (not moved)
        const manifestPath = path.join(tmpRoot, 'projects', '_staging', 'reject-me', 'manifest.json');
        assertTruthy('rejected project still in staging', fs.existsSync(manifestPath));
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        assert('rejected manifest status', manifest.status, 'rejected');
        assert('rejected manifest reviewedBy', manifest.reviewedBy, 'not ready');
    }

    // ── 9) Review: approve (moves from staging to projects) ──
    console.log('\n=== CHARACTERIZATION: PATCH /api/review/:id (approve) ===');
    {
        // Submit a project to approve
        await request('POST', '/api/submit', {
            title: 'Approve Me',
            description: 'will be approved',
            author: 'test'
        });

        const stagingBefore = path.join(tmpRoot, 'projects', '_staging', 'approve-me');
        assertTruthy('approve-me exists in staging before', fs.existsSync(stagingBefore));

        const res = await request('PATCH', '/api/review/approve-me', {
            action: 'approve',
            notes: 'looks great'
        });
        assert('approve → 200', res.status, 200);
        assert('approve success', res.body.success, true);
        assert('approve action', res.body.action, 'approved');
        assert('approve status', res.body.project.status, 'published');

        // Verify moved from staging to projects
        assertTruthy('approve-me removed from staging', !fs.existsSync(stagingBefore));
        const projectDir = path.join(tmpRoot, 'projects', 'approve-me');
        assertTruthy('approve-me exists in projects', fs.existsSync(projectDir));

        const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'manifest.json'), 'utf8'));
        assert('approved manifest status', manifest.status, 'published');
        assert('approved manifest reviewedBy', manifest.reviewedBy, 'looks great');
        assertTruthy('approved manifest has published date', manifest.published && manifest.published.includes('T'));
    }

    // ── 10) Review: not found ────────────────────────────
    console.log('\n=== CHARACTERIZATION: PATCH /api/review/:id (not found) ===');
    {
        const res = await request('PATCH', '/api/review/nonexistent-project', { action: 'approve' });
        assert('not found → 404', res.status, 404);
        assert('not found error', res.body.error, 'Project not found in staging or projects');
    }

    // ── 11) Review: approve existing project in main dir ─
    console.log('\n=== CHARACTERIZATION: PATCH review for project in main dir ===');
    {
        // Create a project directly in projects/ (not staging)
        const mainProjectDir = path.join(tmpRoot, 'projects', 'main-project');
        fs.mkdirSync(mainProjectDir, { recursive: true });
        fs.writeFileSync(path.join(mainProjectDir, 'manifest.json'), JSON.stringify({
            id: 'main-project', title: 'Main Project', status: 'review'
        }, null, 2));

        const res = await request('PATCH', '/api/review/main-project', {
            action: 'approve',
            notes: 'admin approved'
        });
        assert('main dir approve → 200', res.status, 200);
        assert('main dir approve status', res.body.project.status, 'published');

        const manifest = JSON.parse(fs.readFileSync(path.join(mainProjectDir, 'manifest.json'), 'utf8'));
        assert('main dir manifest status', manifest.status, 'published');
        assert('main dir manifest reviewedBy', manifest.reviewedBy, 'admin approved');
    }

    // ============================================================
    // Cleanup
    // ============================================================
    fs.rmSync(tmpRoot, { recursive: true, force: true });

    // ============================================================
    // Summary
    // ============================================================
    console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test runner error:', err);
    // Try cleanup
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch(e) {}
    process.exit(1);
});
