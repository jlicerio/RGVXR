/**
 * WebXR Camera Tests
 * 
 * This file adds routes for WebXR camera testing
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Create router for the WebXR tests
const webxrTestsRouter = express.Router();

// Serve the test files
webxrTestsRouter.get('/basic-camera', (req, res) => {
    res.sendFile(path.join(__dirname, 'test', 'basic-camera.html'));
});

webxrTestsRouter.get('/explicit-passthrough', (req, res) => {
    res.sendFile(path.join(__dirname, 'test', 'explicit-passthrough.html'));
});

webxrTestsRouter.get('/browser-specific', (req, res) => {
    res.sendFile(path.join(__dirname, 'test', 'browser-specific.html'));
});

// Create test files if they don't exist
function ensureTestFiles() {
    const testDir = path.join(__dirname, 'test');
    
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Basic camera test
    const basicCameraPath = path.join(testDir, 'basic-camera.html');
    const basicCameraContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Basic WebXR Camera Test</title>
    <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
    <style>
        body { margin: 0; }
    </style>
</head>
<body>
    <a-scene 
        webxr="requiredFeatures: local-floor;"
        renderer="alpha: true;">
        
        <a-box position="0 1.5 -3" color="red"></a-box>
        <a-camera></a-camera>
    </a-scene>
    
    <script>
        console.log("Test 1: Basic WebXR Camera Test");
        
        document.querySelector('a-scene').addEventListener('loaded', function() {
            console.log('Scene loaded');
        });
        
        document.querySelector('a-scene').addEventListener('enter-vr', function() {
            console.log('Entering VR/AR mode');
            console.log('Is AR mode:', this.is('ar-mode'));
        });
    </script>
</body>
</html>`;
    
    // Explicit passthrough test
    const explicitPassthroughPath = path.join(testDir, 'explicit-passthrough.html');
    const explicitPassthroughContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Explicit Camera Passthrough Test</title>
    <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
    <style>
        body { margin: 0; }
    </style>
</head>
<body>
    <a-scene 
        webxr="requiredFeatures: local-floor, camera-access;"
        renderer="alpha: true;">
        
        <a-box position="0 1.5 -3" color="red"></a-box>
        <a-camera></a-camera>
    </a-scene>
    
    <script>
        console.log("Test 2: Explicit Camera Passthrough Test");
        
        document.querySelector('a-scene').addEventListener('loaded', function() {
            console.log('Scene loaded');
            // Force transparent background
            this.renderer.setClearColor('#000', 0);
        });
        
        document.querySelector('a-scene').addEventListener('enter-vr', function() {
            console.log('Entering VR/AR mode');
            console.log('Is AR mode:', this.is('ar-mode'));
            
            const session = this.xrSession;
            if (session) {
                console.log('Session mode:', session.mode);
                console.log('Environment blend mode:', session.environmentBlendMode);
            }
        });
    </script>
</body>
</html>`;
    
    // Browser-specific test
    const browserSpecificPath = path.join(testDir, 'browser-specific.html');
    const browserSpecificContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Browser-Specific Camera Test</title>
    <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
    <style>
        body { margin: 0; }
    </style>
</head>
<body>
    <div id="browser-info" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.7); color:white; padding:10px; z-index:1000;"></div>
    
    <a-scene 
        webxr="requiredFeatures: local-floor;"
        renderer="alpha: true;">
        
        <a-box position="0 1.5 -3" color="red"></a-box>
        <a-camera></a-camera>
    </a-scene>
    
    <script>
        console.log("Test 3: Browser-Specific Test");
        
        // Detect browser
        const browserInfo = document.getElementById('browser-info');
        const ua = navigator.userAgent;
        let browserName = "Unknown";
        
        if (ua.includes("Chrome")) browserName = "Chrome";
        else if (ua.includes("Firefox")) browserName = "Firefox";
        else if (ua.includes("Safari") && !ua.includes("Chrome")) browserName = "Safari";
        else if (ua.includes("Edg")) browserName = "Edge";
        
        browserInfo.textContent = \`Browser: \${browserName}\`;
        console.log(\`Browser detected: \${browserName}\`);
        
        // Check WebXR support
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-ar').then(supported => {
                console.log('AR supported:', supported);
                browserInfo.textContent += \`\\nAR supported: \${supported}\`;
                
                if (supported) {
                    // Check specific features
                    const features = [
                        'local-floor',
                        'hit-test',
                        'camera-access',
                        'dom-overlay'
                    ];
                    
                    features.forEach(feature => {
                        console.log(\`Checking feature: \${feature}\`);
                    });
                }
            });
        } else {
            console.log('WebXR not supported');
            browserInfo.textContent += '\\nWebXR not supported';
        }
    </script>
</body>
</html>`;
    
    // Write the files if they don't exist
    if (!fs.existsSync(basicCameraPath)) {
        fs.writeFileSync(basicCameraPath, basicCameraContent);
    }
    
    if (!fs.existsSync(explicitPassthroughPath)) {
        fs.writeFileSync(explicitPassthroughPath, explicitPassthroughContent);
    }
    
    if (!fs.existsSync(browserSpecificPath)) {
        fs.writeFileSync(browserSpecificPath, browserSpecificContent);
    }
}

// Create test files when the module is loaded
ensureTestFiles();

// Export the router
module.exports = webxrTestsRouter; 