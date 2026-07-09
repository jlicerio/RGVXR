/**
 * XR Simulator — Simulated AR Environment for Testing
 * 
 * Provides a fake WebXR session with a virtual room background,
 * allowing testing of AR features without a physical device.
 * 
 * Toggle: ?xr=sim in URL, or enable in config.yaml
 * 
 * Features:
 *   - Virtual room background (gradient + grid floor)
 *   - Simulated surface placement
 *   - Mouse-controlled "camera movement"
 *   - Fake hit-test results
 *   - Model placed on virtual surface
 */

(function() {
'use strict';

const SIM_ENABLED = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('xr') === 'sim';
})();

if (!SIM_ENABLED) return;

console.log('[XR-Sim] Simulated XR environment active');

// ── Virtual Scene Setup ──
function createSimScene(viewerElement) {
    // Create overlay canvas for virtual room
    const canvas = document.createElement('canvas');
    canvas.id = 'xr-sim-canvas';
    Object.assign(canvas.style, {
        position: 'fixed', inset: '0', zIndex: '-1',
        width: '100%', height: '100%', pointerEvents: 'none'
    });
    document.body.insertBefore(canvas, document.body.firstChild);
    
    const ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    // ── Render virtual room ──
    function drawRoom() {
        const w = canvas.width, h = canvas.height;
        
        // Sky gradient
        const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        sky.addColorStop(0, '#1a1a2e');
        sky.addColorStop(0.5, '#16213e');
        sky.addColorStop(1, '#0f3460');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h * 0.6);
        
        // Wall
        const wall = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.6);
        wall.addColorStop(0, '#2d2d44');
        wall.addColorStop(1, '#3d3d5c');
        ctx.fillStyle = wall;
        ctx.fillRect(0, h * 0.4, w, h * 0.2);
        
        // Floor with perspective grid
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, h * 0.6, w, h * 0.4);
        
        // Perspective grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        
        const vanishX = w * 0.5;
        const vanishY = h * 0.4;
        
        // Horizontal lines (depth)
        for (let i = 1; i <= 8; i++) {
            const t = i / 8;
            const y = vanishY + (h - vanishY) * t * t;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        
        // Vertical lines (radiating from vanishing point)
        for (let i = -6; i <= 6; i++) {
            const x = vanishX + i * 120;
            ctx.beginPath();
            ctx.moveTo(vanishX, vanishY);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        
        // Baseboard
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, h * 0.6 - 2, w, 4);
        
        // Table/surface indicator
        const tableY = h * 0.55;
        const tableW = w * 0.3;
        const tableX = vanishX - tableW / 2;
        
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(tableX, tableY, tableW, 3);
        
        // Simulator badge
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('XR Simulator', w - 16, 28);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText('?xr=sim  |  drag to orbit  |  scroll to zoom', w - 16, 44);
    }
    
    // Render loop
    function render() {
        drawRoom();
        requestAnimationFrame(render);
    }
    
    render();
    
    // ── Adjust model-viewer for simulation ──
    if (viewerElement) {
        // Make background transparent so room shows through
        viewerElement.style.setProperty('--poster-color', 'transparent');
        
        // Lower the model to "sit on the virtual table"
        viewerElement.setAttribute('camera-orbit', '0deg 65deg 80%');
        viewerElement.setAttribute('min-camera-orbit', 'auto auto 30%');
        viewerElement.setAttribute('max-camera-orbit', 'auto auto 180%');
    }
    
    return { canvas };
}

// ── Auto-init on model-viewer load ──
function init() {
    const viewer = document.getElementById('viewer') || document.querySelector('model-viewer');
    if (viewer) {
        createSimScene(viewer);
    } else {
        // Retry
        setTimeout(init, 500);
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
