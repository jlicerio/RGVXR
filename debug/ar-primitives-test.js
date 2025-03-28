const fs = require('fs');
const path = require('path');

// Test configuration
const testConfig = {
    projectName: 'ar-primitives',
    projectTitle: 'AR Primitives Demo',
    markerSource: path.join(__dirname, '..', 'projects', 'ar object', 'assets', 'marker.patt')
};

// Create project directory structure
function createProjectStructure() {
    console.log('Creating AR Primitives test project...');
    
    const projectDir = path.join(__dirname, '..', 'projects', testConfig.projectName);
    const assetsDir = path.join(projectDir, 'assets');
    
    // Create directories
    if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
        console.log(`Created directory: ${projectDir}`);
    }
    
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        console.log(`Created directory: ${assetsDir}`);
    }
    
    // Copy marker pattern
    const markerDest = path.join(assetsDir, 'marker.patt');
    fs.copyFileSync(testConfig.markerSource, markerDest);
    console.log(`Copied marker pattern to: ${markerDest}`);
    
    // Create index.html
    const indexPath = path.join(projectDir, 'index.html');
    const indexContent = `<!DOCTYPE html>
<html>
    <head>
        <title>${testConfig.projectTitle}</title>
        <script src="https://cdn.jsdelivr.net/gh/aframevr/aframe@1.3.0/dist/aframe-master.min.js"></script>
        <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
        <style>
            body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            
            .arjs-loader {
                height: 100%;
                width: 100%;
                position: absolute;
                top: 0;
                left: 0;
                background-color: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .arjs-loader div {
                text-align: center;
                font-size: 1.25em;
                color: white;
            }
            
            .a-enter-vr {
                display: none !important;
            }
        </style>
    </head>
    <body>
        <!-- Loading screen -->
        <div class="arjs-loader">
            <div>Loading, please allow camera access...</div>
        </div>
        
        <!-- AR Scene -->
        <a-scene 
            embedded 
            vr-mode-ui="enabled: false"
            renderer="logarithmicDepthBuffer: true; precision: medium; antialias: true;"
            arjs="sourceType: webcam; debugUIEnabled: true; detectionMode: mono_and_matrix; matrixCodeType: 3x3;">
            
            <a-marker type="pattern" url="assets/marker.patt">
                <!-- A-Frame primitives -->
                <a-box position="-1 0.5 0" rotation="0 45 0" color="#4CC3D9" shadow></a-box>
                <a-sphere position="0 1.25 0" radius="0.5" color="#EF2D5E" shadow></a-sphere>
                <a-cylinder position="1 0.75 0" radius="0.5" height="1.5" color="#FFC65D" shadow></a-cylinder>
                <a-plane position="0 0 0" rotation="-90 0 0" width="4" height="4" color="#7BC8A4" shadow></a-plane>
            </a-marker>
            
            <a-entity camera></a-entity>
        </a-scene>
        
        <script>
            // Remove loader when scene is loaded
            const scene = document.querySelector('a-scene');
            scene.addEventListener('loaded', function () {
                const loader = document.querySelector('.arjs-loader');
                if (loader) {
                    loader.style.display = 'none';
                }
            });
            
            // Force camera access
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(function(stream) {
                    console.log('Camera access granted');
                    window.cameraStream = stream; // Store for later use
                })
                .catch(function(err) {
                    console.error('Camera access error:', err);
                    alert('Please allow camera access for AR to work');
                });
                
            // Listen for messages from parent window
            window.addEventListener('message', function(event) {
                if (event.data === 'pause' && window.cameraStream) {
                    // Pause camera when project is inactive
                    window.cameraStream.getTracks().forEach(track => track.enabled = false);
                } else if (event.data === 'resume' && window.cameraStream) {
                    // Resume camera when project is active
                    window.cameraStream.getTracks().forEach(track => track.enabled = true);
                }
            });
        </script>
    </body>
</html>`;
    
    fs.writeFileSync(indexPath, indexContent);
    console.log(`Created index.html at: ${indexPath}`);
    
    console.log('AR Primitives test project created successfully!');
    return {
        projectDir,
        indexPath,
        markerPath: markerDest
    };
}

// Run the test
const projectFiles = createProjectStructure();
console.log('\nTest project created. To verify:');
console.log('1. Start the server with: DEBUG=true node server.js');
console.log('2. Open the debug dashboard at: http://localhost:8080/debug');
console.log('3. Click "Scan Projects" to verify the new project is detected');
console.log('4. Open the carousel at: http://localhost:8080');
console.log('5. Navigate to the "AR Primitives Demo" project');
console.log('6. Test with the marker pattern'); 