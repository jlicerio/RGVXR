/**
 * RGVXR Platform — Client-Side Core
 * 
 * Config-driven AR gallery with pluggable connector system.
 * Loads platform config, manages connectors, projects, and viewer.
 * 
 * Usage:
 *   <script type="module" src="/js/platform.js"></script>
 *   Then access: window.RGVXR
 */

(function() {
'use strict';

// Compute base path for sub-path deployments
const BASE = (() => {
    const p = window.location.pathname;
    const m = p.match(/^(\/.+?)\/(index\.html)?$/);
    return m ? m[1] : '';
})();


// ============================================================
// Platform State
// ============================================================
const state = {
    config: null,           // /api/config response
    projects: [],           // filtered, published projects
    currentIdx: 0,
    userLocation: null,
    demoMode: true,         // Start in demo mode — all projects accessible
    unlocked: new Set(),    // indices of unlocked projects
    loading: false,
    connectors: {},         // instantiated client connectors
    viewer: null            // model-viewer element
};

// ============================================================
// Client Connector Interface
// Each connector loaded from config gets instantiated here.
// Mirrors server-side interface but runs in browser.
// ============================================================

const clientConnectors = {
    /**
     * GPS connector — uses browser Geolocation API
     */
    gps: {
        id: 'gps',
        init(cfg) {
            this.config = cfg || {};
            this.defaultRadius = this.config.defaultRadius || 2000;
        },
        
        async check(project) {
            const loc = project.location || project.unlockMethods?.gps;
            if (!loc) return { unlocked: false, reason: 'no GPS data' };
            if (!state.userLocation) return { unlocked: false, reason: 'location not available' };
            
            // Canonical math lives in lib/haversine.js on server; client keeps matching inline copy
            const dist = haversine(
                state.userLocation.lat, state.userLocation.lng,
                loc.lat, loc.lng
            );
            const radius = loc.radius || this.defaultRadius;
            const unlocked = dist <= radius;
            
            return {
                unlocked,
                reason: unlocked
                    ? `within range (${fmtDist(dist)})`
                    : `${fmtDist(dist)} away`,
                data: { distance: dist, radius, locationName: loc.name }
            };
        },
        
        requestLocation() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) return reject(new Error('GPS not available'));
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        resolve(state.userLocation);
                    },
                    err => reject(err),
                    {
                        enableHighAccuracy: this.config.highAccuracy || false,
                        timeout: this.config.timeout || 10000,
                        maximumAge: this.config.maxAge || 300000
                    }
                );
            });
        },
        
        getStatus() {
            if (!navigator.geolocation) return { icon: '📍', text: 'GPS unavailable', ready: false };
            if (state.userLocation) return { icon: '📍', text: 'GPS ready', ready: true };
            return { icon: '📍', text: 'Locating…', ready: false, searching: true };
        }
    },
    
    /**
     * Always connector — fallback, never locks
     */
    always: {
        id: 'always',
        init() {},
        async check() { return { unlocked: true, reason: 'always available' }; },
        getStatus() { return { icon: '🌐', text: 'Active', ready: true }; }
    },
    
    /**
     * Image recognition connector — placeholder for MindAR
     */
    'image-recognition': {
        id: 'image-recognition',
        init(cfg) { this.config = cfg || {}; },
        async check(project) {
            const hasTarget = !!(project.unlockMethods?.['image-recognition']?.imageUrl);
            return { unlocked: !hasTarget, reason: hasTarget ? 'image recognition required' : 'no target image' };
        },
        getStatus() { return { icon: '📷', text: 'Coming soon', ready: false }; }
    }
};

// ============================================================
// Haversine distance
// CANONICAL SOURCE: lib/haversine.js — keep this copy in sync.
// Inline copy required because this file runs as a browser IIFE.
// ============================================================
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function fmtDist(m) { return m < 1000 ? Math.round(m) + 'm' : (m/1000).toFixed(1) + 'km'; }

// ============================================================
// Platform Init
// ============================================================
async function init(viewerElement) {
    state.viewer = viewerElement || document.getElementById('viewer');
    
    // 1. Load platform config
    try {
        const resp = await fetch(BASE + '/api/config');
        state.config = await resp.json();
    } catch (e) {
        console.warn('[RGVXR] Failed to load config, using defaults');
        state.config = { gallery: {}, viewer: {}, connectors: [] };
    }
    
    // 2. Initialize enabled client connectors
    const connList = state.config.connectors || [];
    for (const c of connList) {
        if (clientConnectors[c.id]) {
            clientConnectors[c.id].init(c.config || {});
            state.connectors[c.id] = clientConnectors[c.id];
        }
    }
    
    // 3. Load projects
    await loadProjects();
    
    // 4. Try GPS if available
    if (state.connectors.gps) {
        try {
            await state.connectors.gps.requestLocation();
        } catch (e) {
            console.log('[RGVXR] GPS:', e.message);
            // Auto-enable demo mode if GPS denied
            if (!state.demoMode) toggleDemoMode();
        }
        refreshUnlocks();
        refreshView();
    }
    
    // 5. Return platform API
    return api;
}

async function loadProjects() {
    try {
        const url = BASE + '/api/projects?status=published';
        const resp = await fetch(url);
        state.projects = await resp.json();
        
        if (!state.projects.length) {
            emit('loadError', { message: 'No projects available' });
        }
        
        // Default: all unlocked until connectors check
        state.projects.forEach((_, i) => state.unlocked.add(i));
    } catch (e) {
        console.error('[RGVXR] Failed to load projects:', e);
        state.projects = [];
        emit('loadError', { message: 'Could not connect to server' });
    }
}

// ============================================================
// Unlock Checking
// ============================================================
async function refreshUnlocks() {
    state.unlocked.clear();
    
    for (let i = 0; i < state.projects.length; i++) {
        const p = state.projects[i];
        const methods = p.unlockMethods || {};
        
        // If no unlock methods specified, always unlocked
        if (Object.keys(methods).length === 0) {
            state.unlocked.add(i);
            p._distance = undefined;
            continue;
        }
        
        // Check each specified method via its connector
        let unlocked = false;
        for (const [methodId] of Object.entries(methods)) {
            const conn = state.connectors[methodId];
            if (!conn) continue;
            
            const result = await conn.check(p);
            if (result.data?.distance !== undefined) {
                p._distance = result.data.distance;
            }
            if (result.unlocked) {
                unlocked = true;
                break;
            }
        }
        
        if (unlocked) state.unlocked.add(i);
    }
}

function isUnlocked(idx) {
    if (state.demoMode) return true;
    return state.unlocked.has(idx);
}

function toggleDemoMode() {
    state.demoMode = !state.demoMode;
    refreshView();
    return state.demoMode;
}

// ============================================================
// Viewer / Carousel
// ============================================================
async function loadModel(idx, skipLockCheck) {
    if (idx < 0 || idx >= state.projects.length) return;
    if (state.loading && !skipLockCheck) return;
    
    // If locked, find nearest unlocked
    if (!isUnlocked(idx) && !skipLockCheck) {
        let best = -1, bestDist = Infinity;
        state.projects.forEach((p, i) => {
            if (isUnlocked(i) && p._distance < bestDist) {
                bestDist = p._distance;
                best = i;
            }
        });
        if (best >= 0) idx = best;
        else return;
    }
    
    state.loading = true;
    const project = state.projects[idx];
    state.currentIdx = idx;
    
    // Splat projects: redirect to standalone viewer (model-viewer can't render .splat)
    if (!project.hasModel && (project.technologies || []).some(t => 
        t.toLowerCase().includes('splat') || t.toLowerCase().includes('gaussian'))) {
        state.loading = false;
        window.location.href = BASE + project.path;
        return;
    }
    
    const dir = project.path.replace(/\/index\.html$/, '');
    const glbUrl = BASE + dir + '/assets/asset.glb';
    
    if (state.viewer) {
        state.viewer.src = null;
        await sleep(50);
        state.viewer.src = glbUrl;
    }
    
    // Safety timeout
    clearTimeout(state._loadTimeout);
    state._loadTimeout = setTimeout(() => {
        if (state.loading) {
            console.warn('[RGVXR] Load timeout — forcing loading=false');
            state.loading = false;
        }
    }, 15000);
    
    emit('modelChange', { index: idx, project });
}

function nextModel() {
    if (!state.projects.length) return;
    loadModel((state.currentIdx + 1) % state.projects.length);
}

function prevModel() {
    if (!state.projects.length) return;
    loadModel((state.currentIdx - 1 + state.projects.length) % state.projects.length);
}

function goToModel(idx) {
    if (idx >= 0 && idx < state.projects.length) loadModel(idx);
}

function refreshView() {
    if (state.projects.length) loadModel(state.currentIdx, true);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// Event System
// ============================================================
const listeners = {};
function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
}
function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
}

// ============================================================
// Public API
// ============================================================
const api = {
    init,
    state,
    nextModel,
    prevModel,
    goToModel,
    loadModel,
    toggleDemoMode,
    isUnlocked,
    refreshUnlocks,
    on,
    connectors: clientConnectors,
    haversine,
    fmtDist
};

// Export globally
window.RGVXR = api;

})();
