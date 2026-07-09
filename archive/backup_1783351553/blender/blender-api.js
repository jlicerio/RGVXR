/**
 * Blender AR Project API
 * 
 * API endpoints for the Blender AR Project add-on
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');

// Create router for the Blender API
const blenderRouter = express.Router();

// Configure storage for uploaded files
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const projectId = req.body.project_id;
        const projectDir = path.join(__dirname, 'projects', projectId, 'assets', 'models');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }
        
        cb(null, projectDir);
    },
    filename: function(req, file, cb) {
        // Use original filename or generate a unique name
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// API endpoint to upload a model from Blender
blenderRouter.post('/api/upload_model', upload.single('model'), (req, res) => {
    const projectId = req.body.project_id;
    const file = req.file;
    
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Update the project's index.html to use the new model
    const projectDir = path.join(__dirname, 'projects', projectId);
    const indexPath = path.join(projectDir, 'index.html');
    
    if (!fs.existsSync(indexPath)) {
        return res.status(404).json({ error: 'Project not found' });
    }
    
    try {
        // Read the index.html file
        let content = fs.readFileSync(indexPath, 'utf8');
        
        // Update the model path
        const modelPath = `/projects/${projectId}/assets/models/${file.filename}`;
        
        // Check if there's an existing model
        const modelRegex = /<a-entity\s+[^>]*src="([^"]+)"[^>]*>/;
        const match = content.match(modelRegex);
        
        if (match) {
            // Replace the existing model
            content = content.replace(modelRegex, `<a-entity src="${modelPath}"`);
        } else {
            // Add a new model entity
            const markerRegex = /<a-marker[^>]*>([\s\S]*?)<\/a-marker>/;
            const markerMatch = content.match(markerRegex);
            
            if (markerMatch) {
                const markerContent = markerMatch[1];
                const newMarkerContent = `${markerContent}\n    <a-entity src="${modelPath}" position="0 0 0" rotation="0 0 0" scale="1 1 1"></a-entity>`;
                content = content.replace(markerContent, newMarkerContent);
            }
        }
        
        // Write the updated content back to the file
        fs.writeFileSync(indexPath, content, 'utf8');
        
        res.json({
            success: true,
            message: 'Model uploaded successfully',
            file: {
                filename: file.filename,
                path: modelPath
            }
        });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get Blender-specific project settings
blenderRouter.get('/project/:id/settings', (req, res) => {
    const projectId = req.params.id;
    const settingsPath = path.join(__dirname, 'projects', projectId, 'blender-settings.json');
    
    try {
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            res.json(settings);
        } else {
            // Return default settings
            res.json({
                scale: 1.0,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 }
            });
        }
    } catch (error) {
        console.error('Error reading project settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to save Blender-specific project settings
blenderRouter.post('/project/:id/settings', (req, res) => {
    const projectId = req.params.id;
    const settings = req.body;
    
    if (!settings) {
        return res.status(400).json({ error: 'Settings are required' });
    }
    
    const projectDir = path.join(__dirname, 'projects', projectId);
    
    if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ error: 'Project not found' });
    }
    
    const settingsPath = path.join(projectDir, 'blender-settings.json');
    
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving project settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to create a new project
blenderRouter.post('/create_project', (req, res) => {
    const { name, type } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
    }
    
    // Create a URL-friendly ID
    const id = name.toLowerCase().replace(/\s+/g, '-');
    
    // Create project directory
    const projectDir = path.join(__dirname, 'projects', name);
    
    if (fs.existsSync(projectDir)) {
        return res.status(400).json({ error: 'A project with this name already exists' });
    }
    
    try {
        // Create project directory
        fs.mkdirSync(projectDir, { recursive: true });
        
        // Create assets directories
        fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'assets', 'models'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'assets', 'images'), { recursive: true });
        
        // Copy the appropriate template based on project type
        let templatePath;
        switch (type) {
            case 'basic':
                templatePath = path.join(__dirname, 'templates', 'basic-ar');
                break;
            case 'model':
                templatePath = path.join(__dirname, 'templates', 'model-ar');
                break;
            case 'primitive':
                templatePath = path.join(__dirname, 'templates', 'primitive-ar');
                break;
            default:
                templatePath = path.join(__dirname, 'templates', 'basic-ar');
        }
        
        // If templates directory doesn't exist, create basic template files
        if (!fs.existsSync(templatePath)) {
            // Create index.html with basic AR template
            const indexContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${name}</title>
    <meta name="description" content="${name} - AR Project">
    <script src="https://aframe.io/releases/1.3.0/aframe.min.js"></script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
    <!-- description: ${name} - AR Project created with Blender AR Project Developer -->
    <!-- author: AR Project Team -->
    <!-- technologies: A-Frame, AR.js, WebXR -->
    <!-- instructions: Point your camera at the marker pattern to view the AR content -->
</head>
<body style="margin: 0; overflow: hidden;">
    <a-scene embedded arjs="sourceType: webcam; debugUIEnabled: false;">
        <a-marker preset="hiro">
            ${type === 'primitive' ? 
                '<a-box position="0 0.5 0" rotation="0 45 0" scale="1 1 1" color="#4CC3D9"></a-box>' : 
                '<a-entity position="0 0 0" rotation="0 0 0" scale="1 1 1"></a-entity>'}
        </a-marker>
        <a-entity camera></a-entity>
    </a-scene>
</body>
</html>`;
            
            fs.writeFileSync(path.join(projectDir, 'index.html'), indexContent);
            
            // Create metadata.json
            const metadataContent = {
                "description": `${name} - AR Project created with Blender AR Project Developer`,
                "author": "AR Project Team",
                "technologies": ["A-Frame", "AR.js", "WebXR"],
                "instructions": "Point your camera at the marker pattern to view the AR content."
            };
            
            fs.writeFileSync(
                path.join(projectDir, 'metadata.json'),
                JSON.stringify(metadataContent, null, 4)
            );
        } else {
            // Copy template files
            const copyDir = (src, dest) => {
                const entries = fs.readdirSync(src, { withFileTypes: true });
                
                for (const entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);
                    
                    if (entry.isDirectory()) {
                        fs.mkdirSync(destPath, { recursive: true });
                        copyDir(srcPath, destPath);
                    } else {
                        let content = fs.readFileSync(srcPath, 'utf8');
                        
                        // Replace template placeholders
                        content = content.replace(/\{\{PROJECT_NAME\}\}/g, name);
                        content = content.replace(/\{\{PROJECT_ID\}\}/g, id);
                        
                        fs.writeFileSync(destPath, content);
                    }
                }
            };
            
            copyDir(templatePath, projectDir);
        }
        
        // Return the new project info
        res.json({
            id: id,
            name: name,
            title: name,
            path: `/projects/${name}/index.html`
        });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add permission fixing endpoint
blenderRouter.post('/fix_permissions', (req, res) => {
    const projectsDir = path.join(__dirname, 'projects');
    
    try {
        // For Windows
        if (process.platform === 'win32') {
            exec(`attrib -r "${projectsDir}\\*.*" /s`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error fixing permissions: ${error.message}`);
                    return res.status(500).json({ error: error.message });
                }
                
                console.log('Permissions fixed successfully');
                res.json({ success: true, message: 'Permissions fixed successfully' });
            });
        } 
        // For macOS/Linux
        else {
            exec(`chmod -R +w "${projectsDir}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error fixing permissions: ${error.message}`);
                    return res.status(500).json({ error: error.message });
                }
                
                console.log('Permissions fixed successfully');
                res.json({ success: true, message: 'Permissions fixed successfully' });
            });
        }
    } catch (error) {
        console.error('Error fixing permissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get GPS data for a project
blenderRouter.get('/project/:id/gps', (req, res) => {
    const projectId = req.params.id;
    const gpsPath = path.join(__dirname, 'projects', projectId, 'gps-data.json');
    
    try {
        if (fs.existsSync(gpsPath)) {
            const gpsData = JSON.parse(fs.readFileSync(gpsPath, 'utf8'));
            res.json(gpsData);
        } else {
            res.status(404).json({ error: 'No GPS data found for this project' });
        }
    } catch (error) {
        console.error('Error reading GPS data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save GPS data for a project
blenderRouter.post('/project/:id/gps', (req, res) => {
    const projectId = req.params.id;
    const { latitude, longitude, radius, notification } = req.body;
    
    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const projectDir = path.join(__dirname, 'projects', projectId);
    
    if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ error: 'Project not found' });
    }
    
    const gpsPath = path.join(projectDir, 'gps-data.json');
    const indexPath = path.join(projectDir, 'index.html');
    
    try {
        // Save GPS data
        const gpsData = {
            latitude,
            longitude,
            radius: radius || 25,
            notification: notification || 'AR content available nearby!'
        };
        
        fs.writeFileSync(gpsPath, JSON.stringify(gpsData, null, 2), 'utf8');
        
        // Update index.html to include GPS functionality
        if (fs.existsSync(indexPath)) {
            let content = fs.readFileSync(indexPath, 'utf8');
            
            // Check if GPS script is already included
            if (!content.includes('gps-entity-place')) {
                // Add GPS scripts and components
                content = content.replace(
                    '<script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>',
                    '<script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>\n' +
                    '    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar-nft.js"></script>\n' +
                    '    <script>\n' +
                    '        // GPS notification system\n' +
                    '        AFRAME.registerComponent("gps-notification", {\n' +
                    '            init: function() {\n' +
                    '                this.watchId = null;\n' +
                    '                this.targetLat = ' + latitude + ';\n' +
                    '                this.targetLon = ' + longitude + ';\n' +
                    '                this.radius = ' + (radius || 25) + ';\n' +
                    '                this.notificationText = "' + (notification || 'AR content available nearby!') + '";\n' +
                    '                this.notified = false;\n' +
                    '                \n' +
                    '                if (navigator.geolocation) {\n' +
                    '                    this.watchId = navigator.geolocation.watchPosition(\n' +
                    '                        this.updatePosition.bind(this),\n' +
                    '                        this.errorHandler.bind(this),\n' +
                    '                        { enableHighAccuracy: true }\n' +
                    '                    );\n' +
                    '                }\n' +
                    '            },\n' +
                    '            \n' +
                    '            updatePosition: function(position) {\n' +
                    '                const distance = this.calculateDistance(\n' +
                    '                    position.coords.latitude,\n' +
                    '                    position.coords.longitude,\n' +
                    '                    this.targetLat,\n' +
                    '                    this.targetLon\n' +
                    '                );\n' +
                    '                \n' +
                    '                console.log("Distance to target: " + distance.toFixed(2) + "m");\n' +
                    '                \n' +
                    '                if (distance <= this.radius && !this.notified) {\n' +
                    '                    this.showNotification();\n' +
                    '                    this.notified = true;\n' +
                    '                } else if (distance > this.radius * 1.5) {\n' +
                    '                    // Reset notification when user moves away\n' +
                    '                    this.notified = false;\n' +
                    '                }\n' +
                    '            },\n' +
                    '            \n' +
                    '            calculateDistance: function(lat1, lon1, lat2, lon2) {\n' +
                    '                const R = 6371e3; // Earth radius in meters\n' +
                    '                const φ1 = lat1 * Math.PI/180;\n' +
                    '                const φ2 = lat2 * Math.PI/180;\n' +
                    '                const Δφ = (lat2-lat1) * Math.PI/180;\n' +
                    '                const Δλ = (lon2-lon1) * Math.PI/180;\n' +
                    '                \n' +
                    '                const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +\n' +
                    '                        Math.cos(φ1) * Math.cos(φ2) *\n' +
                    '                        Math.sin(Δλ/2) * Math.sin(Δλ/2);\n' +
                    '                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));\n' +
                    '                \n' +
                    '                return R * c; // Distance in meters\n' +
                    '            },\n' +
                    '            \n' +
                    '            showNotification: function() {\n' +
                    '                // Create notification element\n' +
                    '                const notification = document.createElement("div");\n' +
                    '                notification.style.position = "fixed";\n' +
                    '                notification.style.top = "20px";\n' +
                    '                notification.style.left = "50%";\n' +
                    '                notification.style.transform = "translateX(-50%)";\n' +
                    '                notification.style.backgroundColor = "rgba(0, 0, 0, 0.8)";\n' +
                    '                notification.style.color = "white";\n' +
                    '                notification.style.padding = "15px 20px";\n' +
                    '                notification.style.borderRadius = "5px";\n' +
                    '                notification.style.zIndex = "999999";\n' +
                    '                notification.style.fontFamily = "Arial, sans-serif";\n' +
                    '                notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";\n' +
                    '                notification.textContent = this.notificationText;\n' +
                    '                \n' +
                    '                document.body.appendChild(notification);\n' +
                    '                \n' +
                    '                // Remove after 5 seconds\n' +
                    '                setTimeout(() => {\n' +
                    '                    notification.style.opacity = "0";\n' +
                    '                    notification.style.transition = "opacity 0.5s";\n' +
                    '                    setTimeout(() => {\n' +
                    '                        document.body.removeChild(notification);\n' +
                    '                    }, 500);\n' +
                    '                }, 5000);\n' +
                    '            },\n' +
                    '            \n' +
                    '            errorHandler: function(error) {\n' +
                    '                console.error("GPS error:", error.message);\n' +
                    '            },\n' +
                    '            \n' +
                    '            remove: function() {\n' +
                    '                if (this.watchId !== null) {\n' +
                    '                    navigator.geolocation.clearWatch(this.watchId);\n' +
                    '                }\n' +
                    '            }\n' +
                    '        });\n' +
                    '    </script>'
                );
                
                // Add the GPS notification component to the scene
                content = content.replace(
                    '<a-scene',
                    '<a-scene gps-notification'
                );
                
                // Update the marker to use GPS
                content = content.replace(
                    '<a-marker preset="hiro">',
                    '<a-entity gps-entity-place="latitude: ' + latitude + '; longitude: ' + longitude + '">'
                );
                
                content = content.replace(
                    '</a-marker>',
                    '</a-entity>'
                );
                
                fs.writeFileSync(indexPath, content, 'utf8');
            } else {
                // Update existing GPS values
                content = content.replace(
                    /this\.targetLat = [^;]+;/,
                    'this.targetLat = ' + latitude + ';'
                );
                
                content = content.replace(
                    /this\.targetLon = [^;]+;/,
                    'this.targetLon = ' + longitude + ';'
                );
                
                content = content.replace(
                    /this\.radius = [^;]+;/,
                    'this.radius = ' + (radius || 25) + ';'
                );
                
                content = content.replace(
                    /this\.notificationText = "[^"]+";/,
                    'this.notificationText = "' + (notification || 'AR content available nearby!') + '";'
                );
                
                content = content.replace(
                    /latitude: [^;]+; longitude: [^;]+/,
                    'latitude: ' + latitude + '; longitude: ' + longitude
                );
                
                fs.writeFileSync(indexPath, content, 'utf8');
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving GPS data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export the router
module.exports = blenderRouter; 