/**
 * Image Recognition Connector — MindAR-based
 * 
 * Unlocks projects when user points camera at a specific target image.
 * Uses MindAR (mind-ar-js) for client-side image tracking.
 * 
 * Server-side: validates manifest, generates target image data.
 * Client-side: initializes MindAR, tracks targets, fires unlock events.
 * 
 * Dependencies (loaded client-side):
 *   mind-ar-js (via CDN): https://cdn.jsdelivr.net/npm/mind-ar@1.2.0/dist/mindar-image.prod.js
 */

const fs = require('fs');
const path = require('path');

module.exports = {
    id: 'image-recognition',
    name: 'Image Recognition',
    description: 'Unlock projects by pointing camera at a specific image (MindAR)',
    
    // Default config from config.yaml
    init(config) {
        this.config = config || {};
        this.library = this.config.library || 'mind-ar';
        this.version = this.config.version || '1.2.0';
    },
    
    /**
     * Server-side check: validate the project has a valid image target configured.
     * The actual recognition happens client-side.
     */
    check(manifest, opts) {
        const imgConfig = manifest.unlockMethods?.['image-recognition'];
        
        if (!imgConfig) {
            return { unlocked: false, reason: 'no image recognition config', data: {} };
        }
        
        // If the project has imageUrl, the user needs to scan it
        if (imgConfig.imageUrl) {
            // Check if client sent a scan result
            if (opts?.imageMatched === true) {
                return { unlocked: true, reason: 'image matched', data: { imageUrl: imgConfig.imageUrl } };
            }
            return { 
                unlocked: false, 
                reason: 'point camera at target image to unlock',
                data: { imageUrl: imgConfig.imageUrl, requiresScan: true }
            };
        }
        
        return { unlocked: false, reason: 'image recognition not configured', data: {} };
    },
    
    getStatus() {
        return { ready: true, message: 'Image recognition available (MindAR ' + this.version + ')' };
    },
    
    /**
     * Returns the JSON Schema for the image-recognition section of a manifest.
     * Used by admin UI to generate the form fields.
     */
    getUISchema() {
        return {
            type: 'object',
            title: 'Image Recognition',
            properties: {
                imageUrl: {
                    type: 'string',
                    title: 'Target Image URL',
                    description: 'URL of the image users must scan to unlock this project',
                    format: 'uri'
                },
                imageWidth: {
                    type: 'number',
                    title: 'Image Physical Width (mm)',
                    description: 'Real-world width of the target image for accurate tracking',
                    default: 150,
                    minimum: 50,
                    maximum: 1000
                }
            },
            required: ['imageUrl']
        };
    },
    
    /**
     * Validate a target image exists and is accessible.
     * Called during project submission review.
     */
    validateImage(imageUrl) {
        if (!imageUrl) return { valid: false, error: 'No image URL provided' };
        
        // Check if file exists locally
        const localPath = path.join(__dirname, '..', '..', imageUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
            return { valid: true, local: true, path: localPath };
        }
        
        // Remote URL — assume valid
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return { valid: true, remote: true, url: imageUrl };
        }
        
        return { valid: false, error: 'Image not found: ' + imageUrl };
    }
};
