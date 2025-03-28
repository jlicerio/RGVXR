const fs = require('fs');
const path = require('path');

// Paths
const templatesDir = path.join(__dirname, '../../templates');
const projectsDir = path.join(__dirname, '../../projects');

// Demo projects to create
const demos = [
    {
        template: 'basic',
        project: 'webxr-basic-demo'
    },
    {
        template: 'gps',
        project: 'webxr-gps-demo'
    },
    {
        template: 'advanced',
        project: 'webxr-advanced-demo'
    }
];

// Create demo projects
demos.forEach(demo => {
    const templatePath = path.join(templatesDir, demo.template);
    const projectPath = path.join(projectsDir, demo.project);

    // Create project directory
    if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
        console.log(`Created directory: ${projectPath}`);
    }

    // Copy template files
    fs.readdirSync(templatePath).forEach(file => {
        const srcPath = path.join(templatePath, file);
        const destPath = path.join(projectPath, file);
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file} to ${demo.project}`);
    });

    // Create assets directory
    const assetsDir = path.join(projectPath, 'assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
        console.log(`Created assets directory for ${demo.project}`);
    }
});

console.log('Demo projects created successfully!'); 