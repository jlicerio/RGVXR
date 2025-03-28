/**
 * AR Project Editor
 * 
 * A development tool for previewing and editing AR projects
 * without needing to test with a physical marker.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Create router for the editor
const editorRouter = express.Router();

// Make sure the router is using express.json middleware
editorRouter.use(express.json());

// Main editor page
editorRouter.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'editor', 'index.html'));
});

// Project list API
editorRouter.get('/api/projects', (req, res) => {
    // Change this to match the server's API endpoint
    // Forward the request to the main API
    const projectsDir = path.join(__dirname, '..', 'projects');
    const projects = [];
    
    try {
        const items = fs.readdirSync(projectsDir);
        
        for (const item of items) {
            const itemPath = path.join(projectsDir, item);
            
            if (fs.statSync(itemPath).isDirectory()) {
                const indexPath = path.join(itemPath, 'index.html');
                
                if (fs.existsSync(indexPath)) {
                    const content = fs.readFileSync(indexPath, 'utf8');
                    const titleMatch = content.match(/<title>(.*?)<\/title>/i);
                    const title = titleMatch ? titleMatch[1] : item;
                    
                    projects.push({
                        id: item.replace(/\s+/g, '-').toLowerCase(),
                        name: item,
                        title: title,
                        path: `/projects/${item}/index.html`
                    });
                }
            }
        }
        
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get project file content
editorRouter.get('/api/project/:id/file', (req, res) => {
    const projectId = req.params.id;
    const filePath = req.query.path;
    
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    
    // Ensure the file path is within the project directory
    const normalizedPath = path.normalize(filePath);
    const projectsDir = path.join(__dirname, '..', 'projects');
    const fullPath = path.join(projectsDir, normalizedPath);
    
    if (!fullPath.startsWith(projectsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            res.json({ content });
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save project file content
editorRouter.post('/api/project/:id/file', (req, res) => {
    const projectId = req.params.id;
    const { path: filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
        return res.status(400).json({ error: 'File path and content are required' });
    }
    
    console.log(`Saving file: ${filePath} for project: ${projectId}`);
    
    // Ensure the file path is within the project directory
    const normalizedPath = path.normalize(filePath);
    const projectsDir = path.join(__dirname, '..', 'projects');
    const fullPath = path.join(projectsDir, normalizedPath);
    
    if (!fullPath.startsWith(projectsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        // Check if the file is writable
        try {
            fs.accessSync(fullPath, fs.constants.W_OK);
        } catch (accessError) {
            console.error(`File is not writable: ${fullPath}`);
            return res.status(403).json({ error: 'File is not writable' });
        }
        
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`File saved successfully: ${fullPath}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export the router
module.exports = editorRouter; 