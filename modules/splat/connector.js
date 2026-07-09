/**
 * Splat Connector — Gaussian splat / point cloud experiences.
 *
 * Implements the standard connector interface.
 * Used for 3D Gaussian Splatting or similar volumetric assets.
 */

module.exports = {
    id: "splat",
    name: "Gaussian Splat / Point Cloud",
    description: "3D Gaussian splat or point cloud renderer experiences",

    init(config) {
        this.formats = config?.supportsFormats || [".spz", ".ply", ".splat"];
    },

    check(manifest) {
        const splatAssets = manifest.assets?.splat || manifest.splat;
        if (splatAssets) {
            return { unlocked: true, reason: "splat data available", data: { splatAssets } };
        }
        return { unlocked: true, reason: "no splat assets configured", data: {} };
    },

    getStatus() {
        return { ready: true, message: "Gaussian Splat renderer available" };
    },

    getUISchema() {
        return {
            type: "object",
            properties: {
                splatFile: { type: "string", title: "Splat File (.spz/.ply)", description: "Path to processed splat file" },
                collisionFile: { type: "string", title: "Collision File (.json)", description: "Path to collision.json voxel map" }
            }
        };
    }
};
