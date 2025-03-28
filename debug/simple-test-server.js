const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8081; // Test server port

// Create webxr-tests directory if it doesn't exist
const webxrTestsDir = path.join(__dirname, 'webxr-tests');
if (!fs.existsSync(webxrTestsDir)) {
    fs.mkdirSync(webxrTestsDir, { recursive: true });
}

// Create test directory if it doesn't exist
const testDir = path.join(webxrTestsDir, 'test');
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
}

// Create test files
const tests = [
    {
        name: 'basic-camera.html',
        content: `<!DOCTYPE html>
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
</html>`
    },
    {
        name: 'explicit-passthrough.html',
        content: `<!DOCTYPE html>
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
</html>`
    },
    {
        name: 'browser-specific.html',
        content: `<!DOCTYPE html>
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
</html>`
    }
];

// Write test files
tests.forEach(test => {
    fs.writeFileSync(path.join(testDir, test.name), test.content);
});

// Create index page
const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebXR Test Server</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1, h2 {
            color: #333;
        }
        .card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
        }
        .test-link {
            display: block;
            margin-bottom: 10px;
            padding: 10px;
            background-color: #f0f0f0;
            border-radius: 4px;
            text-decoration: none;
            color: #333;
        }
        .test-link:hover {
            background-color: #e0e0e0;
        }
        .description {
            color: #666;
            margin-top: 5px;
        }
        .note {
            background-color: #fffde7;
            padding: 10px;
            border-left: 4px solid #ffd600;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <h1>WebXR Test Server</h1>
    
    <div class="note">
        <p><strong>Note:</strong> This is a dedicated test server running on port 8081.</p>
        <p>Your main application is running on port 8080.</p>
    </div>
    
    <div class="card">
        <h2>Available Tests</h2>
        
        <a href="/test/basic-camera.html" class="test-link" target="_blank">
            Test 1: Basic WebXR Camera Test
            <div class="description">Simple test with minimal configuration</div>
        </a>
        
        <a href="/test/explicit-passthrough.html" class="test-link" target="_blank">
            Test 2: Explicit Camera Passthrough Test
            <div class="description">Test with explicit camera-access feature</div>
        </a>
        
        <a href="/test/browser-specific.html" class="test-link" target="_blank">
            Test 3: Browser-Specific Test
            <div class="description">Test with browser detection and feature checking</div>
        </a>
    </div>
    
    <div class="card">
        <h2>Main Application</h2>
        <a href="https://localhost:8080" class="test-link" target="_blank">
            Go to Main Application
            <div class="description">Opens your AR Projects Gallery on port 8080</div>
        </a>
    </div>
</body>
</html>`;

fs.writeFileSync(path.join(webxrTestsDir, 'index.html'), indexContent);

// ONLY serve files from webxr-tests directory
app.use(express.static(webxrTestsDir));

// HTTPS configuration
const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
};

// Create HTTPS server
const server = https.createServer(httpsOptions, app);

// Start the server
server.listen(port, () => {
    console.log(`\nWebXR Test Server running at:`);
    console.log(`- https://localhost:${port}`);
    
    // Get network interfaces
    const interfaces = require('os').networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`- https://${iface.address}:${port}`);
            }
        }
    }
    
    console.log('\nAccess tests at:');
    console.log(`- https://localhost:${port}/test/basic-camera.html`);
    console.log(`- https://localhost:${port}/test/explicit-passthrough.html`);
    console.log(`- https://localhost:${port}/test/browser-specific.html`);
}); 