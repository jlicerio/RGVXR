/**
 * splat-physics-engine.js — Gaussian Splat Collision Boundary System
 * 
 * A-Frame component that loads SplatTransform v2.0 collision.json voxel maps
 * and registers them for WebXR raycasting and spatial hit-testing.
 * 
 * Usage:
 *   <a-entity splat-voxel-collider="colliderDataUrl: assets/collision.json"></a-entity>
 * 
 * Compatible with A-Frame 1.3+ and WebXR hit-test sessions.
 */

AFRAME.registerComponent('splat-voxel-collider', {
    schema: {
        colliderDataUrl:  { type: 'string', default: 'assets/collision.json' },
        debugVisible:     { type: 'boolean', default: false },
        voxelOpacity:     { type: 'number', default: 0.15 },
        hitThreshold:     { type: 'number', default: 0.1 },
        enabled:          { type: 'boolean', default: true }
    },

    init: function() {
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 50;
        this.collisionData = null;
        this.debugGroup = null;
        this.hitboxMeshes = [];
        this.voxelCenters = [];

        if (this.data.enabled) {
            this.loadCollisionGeometry();
        }

        // Register click handler for spatial intersections
        this.el.addEventListener('click', (evt) => this.onClick(evt));
        this.el.addEventListener('raycaster-intersected', (evt) => this.onRayHit(evt));
    },

    loadCollisionGeometry: function() {
        const url = this.data.colliderDataUrl;
        
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                this.collisionData = data;
                console.log(`[splat-collider] Loaded voxel map: ${(data.voxels || []).length} voxels, res: ${data.res || '?'}`);
                this.buildCollisionVolumes(data);
                this.el.emit('collider-ready', { voxelCount: (data.voxels || []).length });
            })
            .catch(err => {
                console.warn(`[splat-collider] Could not load ${url}:`, err.message);
                // Emit event so UI can show fallback
                this.el.emit('collider-error', { error: err.message });
            });
    },

    buildCollisionVolumes: function(data) {
        if (!data.voxels || !Array.isArray(data.voxels)) return;

        const res = data.res || 1;
        const geometry = new THREE.BoxGeometry(res * 0.9, res * 0.9, res * 0.9);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            wireframe: this.data.debugVisible,
            transparent: true,
            opacity: this.data.debugVisible ? this.data.voxelOpacity : 0,
            depthTest: true,
            depthWrite: false
        });

        this.debugGroup = new THREE.Group();
        this.debugGroup.name = 'splat-collision-debug';

        // Build bounding boxes for each active voxel
        this.voxelCenters = [];
        this.hitboxMeshes = [];

        for (const pos of data.voxels) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.position.set(pos[0], pos[1], pos[2]);
            mesh.userData = { isVoxel: true, voxelPos: pos };
            
            this.debugGroup.add(mesh);
            this.hitboxMeshes.push(mesh);
            this.voxelCenters.push(new THREE.Vector3(pos[0], pos[1], pos[2]));
        }

        this.el.object3D.add(this.debugGroup);

        // Build a merged bounding box for coarse intersection tests
        if (this.voxelCenters.length > 0) {
            this.boundingBox = new THREE.Box3().setFromPoints(this.voxelCenters);
        }
    },

    /**
     * Raycast against the voxel grid and return the closest hit.
     * @param {THREE.Raycaster} raycaster 
     * @returns {{ point: THREE.Vector3, voxelIndex: number } | null}
     */
    raycast: function(raycaster) {
        if (!this.hitboxMeshes.length || !this.data.enabled) return null;

        // Coarse check: bounding box
        if (this.boundingBox) {
            const boxHit = raycaster.ray.intersectBox(this.boundingBox, new THREE.Vector3());
            if (!boxHit) return null;
        }

        // Fine check: individual voxels
        let closestDist = Infinity;
        let closestPoint = null;
        let closestIndex = -1;

        for (let i = 0; i < this.hitboxMeshes.length; i++) {
            const intersects = raycaster.intersectObject(this.hitboxMeshes[i], false);
            if (intersects.length > 0 && intersects[0].distance < closestDist) {
                closestDist = intersects[0].distance;
                closestPoint = intersects[0].point.clone();
                closestIndex = i;
            }
        }

        if (closestPoint && closestDist < this.data.hitThreshold * 10) {
            return { point: closestPoint, distance: closestDist, voxelIndex: closestIndex };
        }

        return null;
    },

    onClick: function(evt) {
        if (!this.data.enabled) return;
        
        const intersection = evt.detail?.intersection;
        if (!intersection || !intersection.point) return;

        console.log(`[splat-collider] Click at:`, 
            intersection.point.x.toFixed(2),
            intersection.point.y.toFixed(2),
            intersection.point.z.toFixed(2)
        );

        this.el.emit('splat-hit', {
            point: intersection.point,
            voxelIndex: -1,
            source: 'aframe-click'
        });
    },

    onRayHit: function(evt) {
        if (!this.data.enabled) return;
        
        // Forward raycaster intersection details
        this.el.emit('splat-ray-hit', {
            details: evt.detail,
            hasCollision: this.hitboxMeshes.length > 0
        });
    },

    /**
     * Toggle debug wireframe visibility
     */
    toggleDebug: function(visible) {
        this.data.debugVisible = visible !== undefined ? visible : !this.data.debugVisible;
        
        if (this.debugGroup) {
            this.debugGroup.children.forEach(mesh => {
                mesh.material.wireframe = this.data.debugVisible;
                mesh.material.opacity = this.data.debugVisible ? this.data.voxelOpacity : 0;
                mesh.material.transparent = true;
            });
        }
    },

    remove: function() {
        if (this.debugGroup) {
            this.el.object3D.remove(this.debugGroup);
            this.debugGroup.children.forEach(m => m.material.dispose());
            this.debugGroup.children.forEach(m => m.geometry.dispose());
        }
        this.hitboxMeshes = [];
        this.voxelCenters = [];
        this.collisionData = null;
    }
});

/**
 * Standalone helper: load and validate a collision.json file.
 * Returns { valid, voxelCount, res, error }
 */
function validateCollisionFile(file) {
    return fetch(file)
        .then(r => r.json())
        .then(data => ({
            valid: true,
            voxelCount: (data.voxels || []).length,
            res: data.res || null,
            bounds: data.bounds || null
        }))
        .catch(err => ({ valid: false, error: err.message }));
}

if (typeof window !== 'undefined') {
    window.validateCollisionFile = validateCollisionFile;
}
