#!/usr/bin/env node
/**
 * process-splats.js — Gaussian Splat Optimization Pipeline
 * 
 * Automates SplatTransform v2.0 CLI to process raw photogrammetry
 * captures (.ply) into optimized multi-stream SPZ v4 archives and
 * collision voxel maps for WebXR physics.
 * 
 * Usage:
 *   node scripts/process-splats.js                    # process all projects
 *   node scripts/process-splats.js --project peyote   # single project
 *   node scripts/process-splats.js --dry-run           # preview only
 * 
 * Dependencies:
 *   @playcanvas/splat-transform (npm global or local)
 *   Install: npm install -g @playcanvas/splat-transform
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────
const PROJECTS_DIR = path.join(__dirname, '..', 'projects');
const DECIMATE_RATIO = '30%';
const SPZ_VERSION = 4;

// Default splat-transform flags
const DEFAULT_FLAGS = [
    '-r', '-90,0,0',        // Fix phone-camera scan orientation
    '--filter-nan',          // Remove NaN vertices
    '--filter-floaters',     // Strip floating noise blobs
    `--decimate ${DECIMATE_RATIO}`,  // Point cloud reduction
    `--spz-version ${SPZ_VERSION}`
];

// ── CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetProject = (() => {
    const idx = args.indexOf('--project');
    return idx >= 0 ? args[idx + 1] : null;
})();

// ── Check CLI availability ────────────────────────────
function checkSplatTransform() {
    try {
        execSync('which splat-transform 2>/dev/null || npx @playcanvas/splat-transform --version 2>/dev/null', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

// ── Process a single project ──────────────────────────
function processProject(folderName) {
    const projectPath = path.join(PROJECTS_DIR, folderName);
    const assetsPath = path.join(projectPath, 'assets');
    
    if (!fs.existsSync(assetsPath)) {
        console.log(`  [skip] ${folderName}: no assets/ directory`);
        return { folder: folderName, status: 'skipped', reason: 'no assets dir' };
    }

    // Look for raw captures
    const rawFiles = fs.readdirSync(assetsPath).filter(f => 
        f.endsWith('.ply') || f.endsWith('.splat') || f.endsWith('.ksplat')
    );

    if (rawFiles.length === 0) {
        console.log(`  [skip] ${folderName}: no raw .ply/.splat files`);
        return { folder: folderName, status: 'skipped', reason: 'no raw files' };
    }

    const results = [];

    for (const rawFile of rawFiles) {
        const inputPath = path.join(assetsPath, rawFile);
        const baseName = rawFile.replace(/\.(ply|splat|ksplat)$/, '');
        const outputSpz = path.join(assetsPath, `${baseName || 'asset'}_field.spz`);
        const outputVoxel = path.join(assetsPath, `${baseName || 'asset'}_collision.json`);
        const statsPath = path.join(assetsPath, `${baseName || 'asset'}_stats.json`);

        const inputSize = (fs.statSync(inputPath).size / (1024 * 1024)).toFixed(1);

        if (dryRun) {
            console.log(`  [dry] ${folderName}/${rawFile} → ${path.basename(outputSpz)} + ${path.basename(outputVoxel)}`);
            results.push({ file: rawFile, status: 'dry-run' });
            continue;
        }

        console.log(`  [proc] ${folderName}/${rawFile} (${inputSize}MB) → optimizing...`);

        try {
            const cmd = [
                'npx @playcanvas/splat-transform',
                `"${inputPath}"`,
                ...DEFAULT_FLAGS,
                `"${outputSpz}"`,
                `"${outputVoxel}"`
            ].join(' ');

            execSync(cmd, { stdio: 'pipe', timeout: 300000 }); // 5 min timeout

            const outputSize = fs.existsSync(outputSpz) 
                ? (fs.statSync(outputSpz).size / (1024 * 1024)).toFixed(1) 
                : '?';
            const ratio = inputSize > 0 ? ((1 - outputSize / inputSize) * 100).toFixed(0) : '?';

            console.log(`  [done] ${folderName}: ${inputSize}MB → ${outputSize}MB (${ratio}% smaller)`);

            // Write stats
            fs.writeFileSync(statsPath, JSON.stringify({
                input: { file: rawFile, sizeMB: parseFloat(inputSize) },
                output: { spz: path.basename(outputSpz), sizeMB: parseFloat(outputSize), ratio: parseInt(ratio) },
                params: { decimate: DECIMATE_RATIO, spzVersion: SPZ_VERSION, flags: DEFAULT_FLAGS },
                processed: new Date().toISOString()
            }, null, 2));

            results.push({ file: rawFile, status: 'processed', outputSizeMB: parseFloat(outputSize), ratio: parseInt(ratio) });

        } catch (err) {
            console.error(`  [FAIL] ${folderName}/${rawFile}:`, err.message);
            results.push({ file: rawFile, status: 'failed', error: err.message });
        }
    }

    return { folder: folderName, status: 'done', results };
}

// ── Main ──────────────────────────────────────────────
function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   RGVXR Splat Optimization Pipeline      ║');
    console.log('║   SplatTransform v2.0 · SPZ v' + SPZ_VERSION + '          ║');
    console.log('╚══════════════════════════════════════════╝\n');

    if (!checkSplatTransform()) {
        console.error('[!] splat-transform CLI not found.');
        console.error('    Install: npm install -g @playcanvas/splat-transform');
        console.error('    Or use npx (auto-install on first run).');
        process.exit(1);
    }

    console.log('[*] splat-transform detected\n');

    if (!fs.existsSync(PROJECTS_DIR)) {
        console.error('[!] projects/ directory not found');
        process.exit(1);
    }

    const folders = targetProject 
        ? [targetProject].filter(f => fs.existsSync(path.join(PROJECTS_DIR, f)))
        : fs.readdirSync(PROJECTS_DIR).filter(f => {
            const p = path.join(PROJECTS_DIR, f);
            return fs.statSync(p).isDirectory() && !f.startsWith('_') && !f.startsWith('.');
        });

    if (folders.length === 0) {
        console.log('No project folders to process.');
        return;
    }

    const summary = [];
    for (const folder of folders) {
        const result = processProject(folder);
        if (result) summary.push(result);
    }

    console.log(`\n─── Summary ───`);
    for (const s of summary) {
        if (s.status === 'done' && s.results) {
            const succeeded = s.results.filter(r => r.status === 'processed').length;
            const failed = s.results.filter(r => r.status === 'failed').length;
            console.log(`  ${s.folder}: ${succeeded} processed, ${failed} failed`);
        } else {
            console.log(`  ${s.folder}: ${s.status} (${s.reason || ''})`);
        }
    }
}

main();
